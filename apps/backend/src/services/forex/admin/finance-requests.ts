/**
 * Forex finance cashier requests (isolated ledger; maker-checker for execution).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { forexAccountExists } from './account-groups.js';
import { createForexAdminApprovalRequest } from './forex-admin-approval-entry.js';

export type ForexFinanceRequestKind =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'CREDIT'
  | 'DEBIT'
  | 'FEE'
  | 'REVERSAL';

export async function createForexFinanceRequest(input: {
  accountId: string;
  kind: ForexFinanceRequestKind;
  amount: string;
  reason: string;
  requestedBy: string;
  currency?: string;
}): Promise<{ request_id: string; approval_id?: string; status: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  if (!(await forexAccountExists(input.accountId))) throw new Error('ACCOUNT_NOT_FOUND');
  const amount = Number.parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

  const requestId = randomUUID();
  const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
    actionType: 'forex_finance_request',
    requestedBy: input.requestedBy,
    payload: {
      requestId,
      accountId: input.accountId,
      kind: input.kind,
      amount: input.amount,
      currency: input.currency ?? 'USD',
      reason,
      targetResource: 'forex_finance_request',
      targetId: requestId,
      correlationId: randomUUID(),
    },
  });

  await db.query(
    `INSERT INTO forex_finance_requests (
       request_id, account_id, kind, amount, currency, status, reason, requested_by, approval_request_id
     ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7::uuid,$8::uuid)`,
    [
      requestId,
      input.accountId,
      input.kind,
      input.amount,
      input.currency ?? 'USD',
      reason,
      input.requestedBy,
      approvalReq.id,
    ],
  );

  return { request_id: requestId, approval_id: approvalReq.id, status: 'PENDING' };
}

export async function listForexFinanceRequests(raw: { page?: string; limit?: string; account_id?: string; status?: string }) {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (raw.account_id?.trim()) {
    params.push(raw.account_id.trim());
    clauses.push(`account_id = $${params.length}`);
  }
  if (raw.status?.trim()) {
    params.push(raw.status.trim().toUpperCase());
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_finance_requests ${where}`, params);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT request_id, account_id, kind, amount, currency, status, reason, approval_request_id, created_at
     FROM forex_finance_requests ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    rows: res.rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
