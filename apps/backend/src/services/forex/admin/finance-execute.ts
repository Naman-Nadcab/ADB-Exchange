/**
 * Executes approved Forex finance requests — idempotent ledger post (Forex ledger only).
 */
import { db } from '../../../lib/database.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { getForexAccountingService } from '../accounting/service.js';
import type { ForexFinanceRequestKind } from './finance-requests.js';

const CREDIT_KINDS = new Set<ForexFinanceRequestKind>(['DEPOSIT', 'CREDIT', 'ADJUSTMENT']);
const DEBIT_KINDS = new Set<ForexFinanceRequestKind>(['WITHDRAWAL', 'DEBIT', 'FEE']);

export type FinanceExecuteResult = {
  request_id: string;
  account_id: string;
  ledger_transaction_id: string;
  status: 'COMPLETED' | 'REPLAY';
  balance_after: string;
};

export async function executeForexFinanceRequest(requestId: string, approvalRequestId: string): Promise<FinanceExecuteResult> {
  const id = requestId.trim();
  if (!id) throw new Error('INVALID_REQUEST_ID');

  const rowRes = await db.query<{
    request_id: string;
    account_id: string;
    kind: string;
    amount: string;
    status: string;
    ledger_transaction_id: string | null;
    approval_request_id: string | null;
  }>(
    `SELECT request_id, account_id, kind, amount, status, ledger_transaction_id, approval_request_id
     FROM forex_finance_requests WHERE request_id = $1::uuid`,
    [id],
  );
  const row = rowRes.rows[0];
  if (!row) throw new Error('FINANCE_REQUEST_NOT_FOUND');
  if (row.approval_request_id && approvalRequestId && String(row.approval_request_id) !== approvalRequestId) {
    throw new Error('APPROVAL_MISMATCH');
  }
  if (row.ledger_transaction_id) {
    const bal = await import('../ledger/persist.js').then((m) => m.customerCashBalanceFromDb(String(row.account_id)));
    return {
      request_id: id,
      account_id: String(row.account_id),
      ledger_transaction_id: String(row.ledger_transaction_id),
      status: 'REPLAY',
      balance_after: bal,
    };
  }
  if (row.status !== 'PENDING' && row.status !== 'PROCESSING') {
    throw new Error(`INVALID_STATUS:${row.status}`);
  }

  const kind = String(row.kind).toUpperCase() as ForexFinanceRequestKind;
  const amount = String(row.amount);
  const accountId = String(row.account_id);
  const idempotencyKey = `FOREX_FINANCE_REQ:${id}`;

  await db.query(`UPDATE forex_finance_requests SET status = 'PROCESSING', updated_at = NOW() WHERE request_id = $1::uuid`, [id]);

  const pricing = getForexPricingService();
  const accounting = getForexAccountingService(getForexPositionService(pricing), pricing);

  try {
    let tx;
    if (CREDIT_KINDS.has(kind)) {
      const ledgerType = kind === 'DEPOSIT' ? 'DEPOSIT' : 'ADJUSTMENT';
      tx = await accounting.postAdminFinanceMovement({
        accountId,
        amount,
        direction: 'credit',
        idempotencyKey,
        ledgerType,
        referenceId: id,
        metadata: { financeRequestId: id, approvalRequestId, kind },
      });
    } else if (DEBIT_KINDS.has(kind)) {
      tx = await accounting.postAdminFinanceMovement({
        accountId,
        amount,
        direction: 'debit',
        idempotencyKey,
        ledgerType: kind === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'ADJUSTMENT',
        referenceId: id,
        metadata: { financeRequestId: id, approvalRequestId, kind },
      });
    } else if (kind === 'REVERSAL') {
      throw new Error('REVERSAL_REQUIRES_LINKED_TX');
    } else {
      throw new Error(`UNSUPPORTED_KIND:${kind}`);
    }

    await db.query(
      `UPDATE forex_finance_requests
       SET status = 'COMPLETED', ledger_transaction_id = $2::uuid, updated_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
       WHERE request_id = $1::uuid`,
      [id, tx.transactionId, JSON.stringify({ executedAt: new Date().toISOString(), fingerprint: tx.fingerprint })],
    );

    const { customerCashBalanceFromDb } = await import('../ledger/persist.js');
    return {
      request_id: id,
      account_id: accountId,
      ledger_transaction_id: tx.transactionId,
      status: 'COMPLETED',
      balance_after: await customerCashBalanceFromDb(accountId),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'EXECUTE_FAILED';
    await db.query(
      `UPDATE forex_finance_requests SET status = 'FAILED', updated_at = NOW(),
       metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE request_id = $1::uuid`,
      [id, JSON.stringify({ error: msg, failedAt: new Date().toISOString() })],
    );
    throw e;
  }
}
