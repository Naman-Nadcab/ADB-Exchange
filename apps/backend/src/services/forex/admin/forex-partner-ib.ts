/**
 * Forex IB / Partner payout. With no FOREX_PARTNER_PAYOUT_URL the ledger posts
 * and external_rail_status stays NOT_CONFIGURED. A configured rail must settle
 * before the ledger moves.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { createForexAdminApprovalRequest } from './forex-admin-approval-entry.js';
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';

export async function listForexPartnerAccruals(partnerId?: string) {
  const params: unknown[] = [];
  const clause = partnerId ? `WHERE partner_id = $1::uuid` : '';
  if (partnerId) params.push(partnerId);
  const res = await db.query(
    `SELECT accrual_id, partner_id, account_id, volume_lots, commission_amount, currency, status, created_at
     FROM forex_partner_commission_accruals ${clause} ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return res.rows;
}

export async function accrueForexPartnerCommission(input: {
  partnerId: string;
  accountId?: string;
  volumeLots: string;
  commissionAmount: string;
  adminId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  const vol = Number.parseFloat(input.volumeLots);
  const amt = Number.parseFloat(input.commissionAmount);
  if (!Number.isFinite(vol) || vol < 0 || !Number.isFinite(amt) || amt <= 0) throw new Error('INVALID_AMOUNTS');
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_partner_commission_accruals (accrual_id, partner_id, account_id, volume_lots, commission_amount, currency, status, metadata)
     VALUES ($1,$2::uuid,$3,$4,$5,'USD','ACCRUED',$6::jsonb)`,
    [id, input.partnerId, input.accountId ?? null, input.volumeLots, input.commissionAmount, JSON.stringify({ reason, admin_id: input.adminId })],
  );
  return { accrual_id: id };
}

export async function createForexPartnerPayoutRequest(input: {
  partnerId: string;
  amount: string;
  reason: string;
  requestedBy: string;
}): Promise<{ payout_id: string; approval_id?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  const amount = Number.parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
  const payoutId = randomUUID();
  const { request: approvalReq } = await createForexAdminApprovalRequest({
    actionType: 'forex_partner_payout',
    requestedBy: input.requestedBy,
    payload: {
      payoutId,
      partnerId: input.partnerId,
      amount: input.amount,
      reason,
      targetResource: 'forex_partner_payout',
      targetId: payoutId,
    },
  });
  await db.query(
    `INSERT INTO forex_partner_payout_requests (payout_id, partner_id, amount, reason, requested_by, approval_request_id, status, external_rail_status)
     VALUES ($1,$2::uuid,$3,$4,$5::uuid,$6::uuid,'PENDING','NOT_CONFIGURED')`,
    [payoutId, input.partnerId, input.amount, reason, input.requestedBy, approvalReq.id],
  );
  return { payout_id: payoutId, approval_id: approvalReq.id };
}

export async function listForexPartnerPayoutRequests(partnerId?: string) {
  const params: unknown[] = [];
  const clause = partnerId ? `WHERE partner_id = $1::uuid` : '';
  if (partnerId) params.push(partnerId);
  const res = await db.query(
    `SELECT payout_id, partner_id, amount, currency, status, external_rail_status, ledger_transaction_id, created_at
     FROM forex_partner_payout_requests ${clause} ORDER BY created_at DESC LIMIT 50`,
    params,
  );
  return res.rows;
}

export async function settleForexPartnerPayoutRail(args: {
  payoutId: string;
  partnerId: string;
  amount: string;
}): Promise<'UNSET' | 'SETTLED' | 'REJECTED'> {
  const url = process.env.FOREX_PARTNER_PAYOUT_URL?.trim() ?? '';
  if (!url) return 'UNSET';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return 'REJECTED';
    const body = (await res.json()) as { status?: unknown };
    return String(body?.status ?? '').toLowerCase() === 'settled' ? 'SETTLED' : 'REJECTED';
  } catch {
    return 'REJECTED';
  }
}

export async function executeForexPartnerPayout(payoutId: string, approvalRequestId: string) {
  const id = payoutId.trim();
  const rowRes = await db.query<{
    payout_id: string;
    partner_id: string;
    amount: string;
    status: string;
    ledger_transaction_id: string | null;
    approval_request_id: string | null;
  }>(
    `SELECT payout_id, partner_id, amount, status, ledger_transaction_id, approval_request_id
     FROM forex_partner_payout_requests WHERE payout_id = $1::uuid`,
    [id],
  );
  const row = rowRes.rows[0];
  if (!row) throw new Error('PAYOUT_NOT_FOUND');
  if (row.ledger_transaction_id) {
    return { payout_id: id, status: 'REPLAY' as const, ledger_transaction_id: String(row.ledger_transaction_id) };
  }
  if (row.status !== 'PENDING' && row.status !== 'PROCESSING') throw new Error('INVALID_PAYOUT_STATUS');
  await db.query(`UPDATE forex_partner_payout_requests SET status = 'PROCESSING', updated_at = NOW() WHERE payout_id = $1::uuid`, [id]);

  const rail = await settleForexPartnerPayoutRail({
    payoutId: id,
    partnerId: String(row.partner_id),
    amount: String(row.amount),
  });
  if (rail === 'REJECTED') {
    await db.query(
      `UPDATE forex_partner_payout_requests SET status = 'REJECTED', external_rail_status = 'REJECTED', updated_at = NOW() WHERE payout_id = $1::uuid`,
      [id],
    );
    throw new Error('PAYOUT_RAIL_REJECTED');
  }

  const pricing = getForexPricingService();
  const accounting = getForexAccountingService(getForexPositionService(pricing), pricing);
  const fp = `FOREX_PARTNER_PAYOUT:${id}`;
  const tx = await accounting.postPartnerPayoutMovement({
    partnerId: String(row.partner_id),
    amount: String(row.amount),
    idempotencyKey: fp,
    referenceId: id,
    externalRail: rail === 'SETTLED' ? 'SETTLED' : 'NOT_CONFIGURED',
  });

  await db.query(
    `UPDATE forex_partner_payout_requests
        SET status = 'COMPLETED',
            ledger_transaction_id = $2::uuid,
            external_rail_status = $3,
            updated_at = NOW()
      WHERE payout_id = $1::uuid`,
    [id, tx.transactionId, rail === 'SETTLED' ? 'SETTLED' : 'NOT_CONFIGURED'],
  );
  await db.query(
    `UPDATE forex_partner_commission_accruals SET status = 'PAID'
     WHERE partner_id = $1::uuid AND status = 'ACCRUED'`,
    [row.partner_id],
  );
  return { payout_id: id, status: 'COMPLETED' as const, ledger_transaction_id: tx.transactionId };
}
