/**
 * Fiat (INR) withdrawal service — ISOLATED ledger.
 *
 * Fiat balances live in `fiat_balances` / `fiat_ledger`, completely separate
 * from the crypto `user_balances`/token system (zero blast radius on crypto
 * deposits, withdrawals and trading). Funding is via admin manual credit;
 * payout is admin-settled (manual provider) with a pluggable provider seam.
 *
 * Lifecycle:
 *   pending --approve--> approved/processing --complete--> completed
 *   pending|approved|processing --reject--> rejected   (locked funds refunded)
 *   pending --cancel(user)--> cancelled                (locked funds refunded)
 *
 * Money math: Decimal.js, ROUND_DOWN, fixed 2 dp.
 */

import type { PoolClient } from 'pg';
import { db } from '../lib/database.js';
import { Decimal, type DecimalInstance } from '../lib/decimal.js';
import { logger, auditLog } from '../lib/logger.js';
import { getFiatPayoutProvider } from './fiat-payout-provider.js';

const FIAT_DP = 2;
const DEFAULT_CURRENCY = 'INR';

function money(v: DecimalInstance | string | number): string {
  return new Decimal(v).toDecimalPlaces(FIAT_DP, Decimal.ROUND_DOWN).toFixed(FIAT_DP);
}

function feeFlat(): DecimalInstance {
  const raw = process.env.FIAT_WITHDRAWAL_FEE_FLAT_INR ?? '0';
  const d = new Decimal(raw);
  return d.isFinite() && d.greaterThanOrEqualTo(0) ? d : new Decimal(0);
}
function minAmount(): DecimalInstance {
  const raw = process.env.FIAT_WITHDRAWAL_MIN_INR ?? '100';
  const d = new Decimal(raw);
  return d.isFinite() && d.greaterThan(0) ? d : new Decimal(100);
}

export interface FiatBalance {
  currency: string;
  available_balance: string;
  locked_balance: string;
}

export interface FiatWithdrawalRow {
  id: string;
  user_id: string;
  currency: string;
  amount: string;
  fee: string;
  net_amount: string;
  bank_account_id: string | null;
  bank_snapshot: Record<string, unknown>;
  status: string;
  provider: string;
  provider_reference: string | null;
  admin_notes: string | null;
  failure_reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
}

export class FiatWithdrawalError extends Error {
  code: string;
  http: number;
  constructor(code: string, message: string, http = 400) {
    super(message);
    this.code = code;
    this.http = http;
  }
}

async function ensureRow(client: PoolClient, userId: string, currency: string): Promise<void> {
  await client.query(
    `INSERT INTO fiat_balances (user_id, currency) VALUES ($1, $2)
     ON CONFLICT (user_id, currency) DO NOTHING`,
    [userId, currency]
  );
}

async function writeLedger(
  client: PoolClient,
  args: {
    userId: string; currency: string; direction: 'debit' | 'credit';
    balanceType: 'available' | 'locked'; amount: string; balanceAfter: string;
    referenceType: string; referenceId?: string | null; notes?: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO fiat_ledger (user_id, currency, direction, balance_type, amount, balance_after, reference_type, reference_id, notes)
     VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric,$7,$8,$9)`,
    [args.userId, args.currency, args.direction, args.balanceType, args.amount, args.balanceAfter,
     args.referenceType, args.referenceId ?? null, args.notes ?? null]
  );
}

export const fiatWithdrawalService = {
  async getBalance(userId: string, currency = DEFAULT_CURRENCY): Promise<FiatBalance> {
    const r = await db.query<{ available_balance: string; locked_balance: string }>(
      `SELECT available_balance::text, locked_balance::text FROM fiat_balances WHERE user_id = $1 AND currency = $2`,
      [userId, currency]
    );
    const row = r.rows[0];
    return {
      currency,
      available_balance: money(row?.available_balance ?? '0'),
      locked_balance: money(row?.locked_balance ?? '0'),
    };
  },

  /** Admin manual credit — the funding source for INR (no fiat deposit rail yet). */
  async adminCredit(adminId: string, userId: string, amountRaw: string, notes?: string): Promise<FiatBalance> {
    const amount = new Decimal(amountRaw);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
      throw new FiatWithdrawalError('INVALID_AMOUNT', 'Amount must be a positive number');
    }
    const amtStr = money(amount);
    const currency = DEFAULT_CURRENCY;
    await db.transaction(async (client) => {
      await ensureRow(client, userId, currency);
      const upd = await client.query<{ available_balance: string }>(
        `UPDATE fiat_balances SET available_balance = available_balance + $1::numeric, updated_at = NOW()
         WHERE user_id = $2 AND currency = $3 RETURNING available_balance::text`,
        [amtStr, userId, currency]
      );
      const after = upd.rows[0]!.available_balance;
      await writeLedger(client, {
        userId, currency, direction: 'credit', balanceType: 'available',
        amount: amtStr, balanceAfter: after, referenceType: 'admin_credit', notes,
      });
    });
    auditLog('fiat_admin_credit', adminId, { userId, amount: amtStr, notes });
    return this.getBalance(userId, currency);
  },

  async createWithdrawal(params: {
    userId: string; amountRaw: string; bankAccountId?: string | null;
    twoFaVerified?: boolean; idempotencyKey?: string | null;
  }): Promise<FiatWithdrawalRow> {
    const { userId } = params;
    const currency = DEFAULT_CURRENCY;
    const amount = new Decimal(params.amountRaw);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
      throw new FiatWithdrawalError('INVALID_AMOUNT', 'Enter a valid withdrawal amount');
    }
    if (amount.lessThan(minAmount())) {
      throw new FiatWithdrawalError('BELOW_MINIMUM', `Minimum withdrawal is ₹${minAmount().toFixed(0)}`);
    }
    const fee = feeFlat();
    const net = amount.minus(fee);
    if (net.lessThanOrEqualTo(0)) {
      throw new FiatWithdrawalError('AMOUNT_TOO_LOW', 'Amount does not cover the withdrawal fee');
    }
    const amtStr = money(amount);
    const feeStr = money(fee);
    const netStr = money(net);

    return db.transaction(async (client) => {
      // Idempotency: return existing request for the same key
      if (params.idempotencyKey) {
        const existing = await client.query<FiatWithdrawalRow>(
          `SELECT * FROM fiat_withdrawals WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [userId, params.idempotencyKey]
        );
        if (existing.rows.length > 0) return existing.rows[0]!;
      }

      // Resolve + snapshot the destination bank account (from saved P2P bank methods)
      let bankSnapshot: Record<string, unknown> = {};
      let bankAccountId: string | null = null;
      if (params.bankAccountId) {
        const bank = await client.query<{ id: string; payment_details: Record<string, unknown>; display_name: string | null; method_name: string; method_code: string }>(
          `SELECT upm.id, upm.payment_details, upm.display_name, pm.name AS method_name, pm.code AS method_code
           FROM user_p2p_payment_methods upm
           JOIN p2p_payment_methods pm ON pm.id = upm.payment_method_id
           WHERE upm.id = $1 AND upm.user_id = $2 AND upm.is_active = TRUE`,
          [params.bankAccountId, userId]
        );
        if (bank.rows.length === 0) {
          throw new FiatWithdrawalError('INVALID_BANK_ACCOUNT', 'Selected bank account not found');
        }
        const b = bank.rows[0]!;
        bankAccountId = b.id;
        bankSnapshot = {
          method_name: b.method_name,
          method_code: b.method_code,
          display_name: b.display_name,
          details: b.payment_details,
        };
      } else {
        throw new FiatWithdrawalError('BANK_ACCOUNT_REQUIRED', 'Add and select a bank account to withdraw INR');
      }

      // Lock the fiat balance row and verify funds
      await ensureRow(client, userId, currency);
      const sel = await client.query<{ available_balance: string; locked_balance: string }>(
        `SELECT available_balance::text, locked_balance::text FROM fiat_balances
         WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
        [userId, currency]
      );
      const avail = new Decimal(sel.rows[0]?.available_balance ?? '0');
      if (avail.lessThan(amount)) {
        throw new FiatWithdrawalError('INSUFFICIENT_BALANCE', 'Insufficient INR balance');
      }
      const upd = await client.query<{ available_balance: string; locked_balance: string }>(
        `UPDATE fiat_balances
         SET available_balance = available_balance - $1::numeric,
             locked_balance = locked_balance + $1::numeric, updated_at = NOW()
         WHERE user_id = $2 AND currency = $3 RETURNING available_balance::text, locked_balance::text`,
        [amtStr, userId, currency]
      );
      const afterAvail = upd.rows[0]!.available_balance;
      const afterLocked = upd.rows[0]!.locked_balance;

      const ins = await client.query<FiatWithdrawalRow>(
        `INSERT INTO fiat_withdrawals
          (user_id, currency, amount, fee, net_amount, bank_account_id, bank_snapshot, status, provider, idempotency_key, two_fa_verified)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6,$7,'pending',$8,$9,$10)
         RETURNING *`,
        [userId, currency, amtStr, feeStr, netStr, bankAccountId, JSON.stringify(bankSnapshot),
         getFiatPayoutProvider().name, params.idempotencyKey ?? null, params.twoFaVerified ?? false]
      );
      const w = ins.rows[0]!;

      await writeLedger(client, {
        userId, currency, direction: 'debit', balanceType: 'available',
        amount: amtStr, balanceAfter: afterAvail, referenceType: 'withdrawal_lock', referenceId: w.id,
      });
      await writeLedger(client, {
        userId, currency, direction: 'credit', balanceType: 'locked',
        amount: amtStr, balanceAfter: afterLocked, referenceType: 'withdrawal_lock', referenceId: w.id,
      });

      auditLog('fiat_withdrawal_created', userId, { withdrawalId: w.id, amount: amtStr });
      return w;
    });
  },

  async listUserWithdrawals(userId: string, limit = 50): Promise<FiatWithdrawalRow[]> {
    const r = await db.query<FiatWithdrawalRow>(
      `SELECT * FROM fiat_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 200)]
    );
    return r.rows;
  },

  /** User cancels a still-pending request; locked funds are refunded. */
  async cancelWithdrawal(userId: string, withdrawalId: string): Promise<FiatWithdrawalRow> {
    return db.transaction(async (client) => {
      const sel = await client.query<FiatWithdrawalRow>(
        `SELECT * FROM fiat_withdrawals WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [withdrawalId, userId]
      );
      if (sel.rows.length === 0) throw new FiatWithdrawalError('NOT_FOUND', 'Withdrawal not found', 404);
      const w = sel.rows[0]!;
      if (w.status !== 'pending') {
        throw new FiatWithdrawalError('NOT_CANCELLABLE', 'Only pending withdrawals can be cancelled');
      }
      await this._refundLocked(client, w, 'withdrawal_cancel');
      const upd = await client.query<FiatWithdrawalRow>(
        `UPDATE fiat_withdrawals SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [withdrawalId]
      );
      auditLog('fiat_withdrawal_cancelled', userId, { withdrawalId });
      return upd.rows[0]!;
    });
  },

  // ---- Admin ----
  async adminList(filters: { status?: string; limit?: number; offset?: number }): Promise<{ rows: FiatWithdrawalRow[]; total: number }> {
    const params: unknown[] = [];
    let where = '';
    if (filters.status) { params.push(filters.status); where = `WHERE fw.status = $${params.length}`; }
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    const totalRes = await db.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM fiat_withdrawals fw ${where}`, params);
    const rows = await db.query<FiatWithdrawalRow & { username: string | null; email: string | null }>(
      `SELECT fw.*, u.username, u.email
       FROM fiat_withdrawals fw JOIN users u ON u.id = fw.user_id
       ${where} ORDER BY fw.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return { rows: rows.rows, total: Number(totalRes.rows[0]?.c ?? '0') };
  },

  async adminApprove(adminId: string, withdrawalId: string, notes?: string): Promise<FiatWithdrawalRow> {
    return db.transaction(async (client) => {
      const sel = await client.query<FiatWithdrawalRow>(`SELECT * FROM fiat_withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId]);
      if (sel.rows.length === 0) throw new FiatWithdrawalError('NOT_FOUND', 'Withdrawal not found', 404);
      const w = sel.rows[0]!;
      if (w.status !== 'pending') throw new FiatWithdrawalError('INVALID_STATE', `Cannot approve a ${w.status} withdrawal`);
      const provider = getFiatPayoutProvider();
      let payoutRef: string | null = null;
      try {
        const res = await provider.initiatePayout({
          withdrawalId: w.id, userId: w.user_id, currency: w.currency,
          amount: w.net_amount, bankDetails: w.bank_snapshot,
        });
        payoutRef = res.reference ?? null;
      } catch (e) {
        logger.warn('Fiat payout provider initiate failed; left for manual completion', {
          withdrawalId: w.id, error: e instanceof Error ? e.message : 'unknown',
        });
      }
      const upd = await client.query<FiatWithdrawalRow>(
        `UPDATE fiat_withdrawals SET status = 'approved', admin_id = $2, admin_notes = COALESCE($3, admin_notes),
           provider_reference = COALESCE($4, provider_reference), reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [withdrawalId, adminId, notes ?? null, payoutRef]
      );
      auditLog('fiat_withdrawal_approved', adminId, { withdrawalId });
      return upd.rows[0]!;
    });
  },

  /** Mark an approved/processing payout as completed (funds leave the locked ledger). */
  async adminComplete(adminId: string, withdrawalId: string, providerReference?: string): Promise<FiatWithdrawalRow> {
    return db.transaction(async (client) => {
      const sel = await client.query<FiatWithdrawalRow>(`SELECT * FROM fiat_withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId]);
      if (sel.rows.length === 0) throw new FiatWithdrawalError('NOT_FOUND', 'Withdrawal not found', 404);
      const w = sel.rows[0]!;
      if (!['approved', 'processing', 'pending'].includes(w.status)) {
        throw new FiatWithdrawalError('INVALID_STATE', `Cannot complete a ${w.status} withdrawal`);
      }
      // Debit the locked funds (money has left the platform)
      const lockSel = await client.query<{ locked_balance: string }>(
        `SELECT locked_balance::text FROM fiat_balances WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
        [w.user_id, w.currency]
      );
      const locked = new Decimal(lockSel.rows[0]?.locked_balance ?? '0');
      if (locked.lessThan(w.amount)) {
        throw new FiatWithdrawalError('LEDGER_INCONSISTENT', 'Locked balance lower than withdrawal amount');
      }
      const upd = await client.query<{ locked_balance: string }>(
        `UPDATE fiat_balances SET locked_balance = locked_balance - $1::numeric, updated_at = NOW()
         WHERE user_id = $2 AND currency = $3 RETURNING locked_balance::text`,
        [money(w.amount), w.user_id, w.currency]
      );
      await writeLedger(client, {
        userId: w.user_id, currency: w.currency, direction: 'debit', balanceType: 'locked',
        amount: money(w.amount), balanceAfter: upd.rows[0]!.locked_balance,
        referenceType: 'withdrawal_complete', referenceId: w.id,
      });
      const res = await client.query<FiatWithdrawalRow>(
        `UPDATE fiat_withdrawals SET status = 'completed', admin_id = $2,
           provider_reference = COALESCE($3, provider_reference), completed_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [withdrawalId, adminId, providerReference ?? null]
      );
      auditLog('fiat_withdrawal_completed', adminId, { withdrawalId, amount: money(w.amount) });
      return res.rows[0]!;
    });
  },

  /** Reject (or fail) — refund the locked funds to available. */
  async adminReject(adminId: string, withdrawalId: string, reason: string): Promise<FiatWithdrawalRow> {
    return db.transaction(async (client) => {
      const sel = await client.query<FiatWithdrawalRow>(`SELECT * FROM fiat_withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId]);
      if (sel.rows.length === 0) throw new FiatWithdrawalError('NOT_FOUND', 'Withdrawal not found', 404);
      const w = sel.rows[0]!;
      if (!['pending', 'approved', 'processing'].includes(w.status)) {
        throw new FiatWithdrawalError('INVALID_STATE', `Cannot reject a ${w.status} withdrawal`);
      }
      await this._refundLocked(client, w, 'withdrawal_reject');
      const upd = await client.query<FiatWithdrawalRow>(
        `UPDATE fiat_withdrawals SET status = 'rejected', admin_id = $2, failure_reason = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [withdrawalId, adminId, reason]
      );
      auditLog('fiat_withdrawal_rejected', adminId, { withdrawalId, reason });
      return upd.rows[0]!;
    });
  },

  /** Move locked funds back to available (refund). Caller holds the withdrawal row lock. */
  async _refundLocked(client: PoolClient, w: FiatWithdrawalRow, referenceType: string): Promise<void> {
    await ensureRow(client, w.user_id, w.currency);
    const lockSel = await client.query<{ locked_balance: string }>(
      `SELECT locked_balance::text FROM fiat_balances WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
      [w.user_id, w.currency]
    );
    const locked = new Decimal(lockSel.rows[0]?.locked_balance ?? '0');
    const refund = Decimal.min(locked, new Decimal(w.amount));
    const upd = await client.query<{ available_balance: string; locked_balance: string }>(
      `UPDATE fiat_balances
       SET locked_balance = locked_balance - $1::numeric,
           available_balance = available_balance + $1::numeric, updated_at = NOW()
       WHERE user_id = $2 AND currency = $3 RETURNING available_balance::text, locked_balance::text`,
      [money(refund), w.user_id, w.currency]
    );
    await writeLedger(client, {
      userId: w.user_id, currency: w.currency, direction: 'debit', balanceType: 'locked',
      amount: money(refund), balanceAfter: upd.rows[0]!.locked_balance, referenceType, referenceId: w.id,
    });
    await writeLedger(client, {
      userId: w.user_id, currency: w.currency, direction: 'credit', balanceType: 'available',
      amount: money(refund), balanceAfter: upd.rows[0]!.available_balance, referenceType, referenceId: w.id,
    });
  },
};
