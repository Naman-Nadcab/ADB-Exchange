/**
 * Referral earnings claim service.
 *
 * Moves a referrer's PENDING referral commissions into their spendable (funding) balance,
 * grouped by commission currency. Atomic and double-claim-safe:
 *  - Pending commission rows are locked FOR UPDATE inside the transaction.
 *  - Each row is flipped pending -> credited only after the balance credit + ledger entry succeed.
 *  - Re-running the claim picks up only rows that are still 'pending'.
 */
import { v4 as uuidv4 } from 'uuid';
import { Decimal, type DecimalInstance } from '../lib/decimal.js';
import { db } from '../lib/database.js';
import {
  ensureUserBalanceRow,
  assertBalanceInvariant,
  CHAIN_ID_GLOBAL,
} from '../lib/user-balance-helper.js';
import { insertBalanceLedger } from '../lib/balance-ledger.js';
import { logger } from '../lib/logger.js';

export interface ClaimedCurrency {
  currency: string;
  amount: string;
}

export interface ClaimReferralResult {
  claimed: ClaimedCurrency[];
  commissionsCredited: number;
  /** Currencies that had pending earnings but no matching currency row (left pending). */
  skippedCurrencies: string[];
}

/**
 * Compute total claimable (pending) referral earnings per currency for a user.
 */
export async function getClaimableReferralEarnings(userId: string): Promise<ClaimedCurrency[]> {
  const res = await db.query<{ commission_currency: string; total: string }>(
    `SELECT commission_currency, SUM(commission_amount)::text AS total
     FROM referral_commissions
     WHERE referrer_id = $1 AND status = 'pending'
     GROUP BY commission_currency
     HAVING SUM(commission_amount) > 0`,
    [userId]
  );
  return res.rows.map((r) => ({ currency: r.commission_currency, amount: r.total }));
}

export async function claimReferralEarnings(userId: string): Promise<ClaimReferralResult> {
  return db.transaction(async (client) => {
    // Lock all pending commission rows for this referrer so a concurrent claim can't double-credit.
    const pending = await client.query<{ id: string; commission_amount: string; commission_currency: string }>(
      `SELECT id, commission_amount::text AS commission_amount, commission_currency
       FROM referral_commissions
       WHERE referrer_id = $1 AND status = 'pending'
       FOR UPDATE`,
      [userId]
    );

    if (pending.rows.length === 0) {
      return { claimed: [], commissionsCredited: 0, skippedCurrencies: [] };
    }

    // Group pending amounts + row ids by currency.
    const byCurrency = new Map<string, { total: DecimalInstance; ids: string[] }>();
    for (const row of pending.rows) {
      const cur = (row.commission_currency || '').trim().toUpperCase();
      if (!cur) continue;
      const entry = byCurrency.get(cur) ?? { total: new Decimal(0), ids: [] };
      entry.total = entry.total.plus(new Decimal(row.commission_amount || '0'));
      entry.ids.push(row.id);
      byCurrency.set(cur, entry);
    }

    const claimed: ClaimedCurrency[] = [];
    const creditedIds: string[] = [];
    const skippedCurrencies: string[] = [];

    for (const [currency, { total, ids }] of byCurrency.entries()) {
      if (total.lte(0)) continue;

      const curRow = await client.query<{ id: string }>(
        `SELECT id FROM currencies WHERE UPPER(TRIM(symbol)) = UPPER(TRIM($1)) LIMIT 1`,
        [currency]
      );
      if (curRow.rows.length === 0) {
        // No matching currency row — leave these commissions pending so they aren't lost.
        skippedCurrencies.push(currency);
        continue;
      }
      const currencyId = curRow.rows[0]!.id;

      await ensureUserBalanceRow(userId, currencyId, CHAIN_ID_GLOBAL, 'funding', client);
      const sel = await client.query<{ available_balance: string }>(
        `SELECT available_balance::text FROM user_balances
         WHERE user_id = $1 AND currency_id = $2 AND COALESCE(chain_id, '') = $3 AND COALESCE(account_type::text, 'funding') = 'funding'
         FOR UPDATE`,
        [userId, currencyId, CHAIN_ID_GLOBAL]
      );
      if (sel.rows.length === 0) {
        skippedCurrencies.push(currency);
        continue;
      }
      const avBefore = new Decimal(sel.rows[0]!.available_balance);
      const upd = await client.query(
        `UPDATE user_balances SET available_balance = available_balance + $1::numeric, updated_at = NOW()
         WHERE user_id = $2 AND currency_id = $3 AND COALESCE(chain_id, '') = $4 AND COALESCE(account_type::text, 'funding') = 'funding'
         RETURNING *`,
        [total.toString(), userId, currencyId, CHAIN_ID_GLOBAL]
      );
      if ((upd.rowCount ?? 0) === 0) {
        skippedCurrencies.push(currency);
        continue;
      }
      assertBalanceInvariant(upd.rows[0]);
      const avAfter = new Decimal(upd.rows[0]!.available_balance ?? 0);

      await insertBalanceLedger({
        client,
        userId,
        currencyId,
        accountType: 'funding',
        debit: '0',
        credit: total.toString(),
        balanceBefore: avBefore.toFixed(),
        balanceAfter: avAfter.toFixed(),
        referenceType: 'adjustment',
        referenceId: uuidv4(),
        balanceType: 'available',
        descriptionSuffix: 'referral_commission_claim',
      });

      claimed.push({ currency, amount: total.toString() });
      creditedIds.push(...ids);
    }

    if (creditedIds.length > 0) {
      await client.query(
        `UPDATE referral_commissions SET status = 'credited', credited_at = NOW()
         WHERE id = ANY($1::uuid[]) AND status = 'pending'`,
        [creditedIds]
      );
    }

    logger.info('Referral earnings claimed', {
      userId,
      currencies: claimed.map((c) => `${c.amount} ${c.currency}`),
      commissionsCredited: creditedIds.length,
    });

    return { claimed, commissionsCredited: creditedIds.length, skippedCurrencies };
  });
}
