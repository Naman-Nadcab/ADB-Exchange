/**
 * Broker vs ledger reconciliation. Building a report never posts cash.
 * Apply posts one forex-ledger ADJUSTMENT, and only when confirm is true
 * and the broker balance is present. Positions are reported, never invented.
 * Crypto user_balances are not touched.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { fxDecimal } from '../decimal-fx.js';
import { getBrokerGateway } from './gateway.js';
import { diffBrokerCashAndPositions, type PositionDrift } from './snapshot-diff.js';

export type ForexBrokerReconciliationReport = {
  reportId: string;
  accountId: string;
  ledgerBalance: string;
  brokerBalance: string | null;
  cashDelta: string | null;
  positionDrift: PositionDrift[];
  status: 'OPEN' | 'APPLIED' | 'UNAVAILABLE';
  persisted: boolean;
};

const memory = new Map<string, ForexBrokerReconciliationReport>();

export function resetBrokerReconciliationForTests(): void {
  memory.clear();
}

export async function buildForexBrokerReconciliation(accountId: string): Promise<ForexBrokerReconciliationReport> {
  const id = accountId.trim();
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const accounting = getForexAccountingService(positions, pricing);
  const snapshot = await getBrokerGateway().fetchSnapshot(id);
  const local = positions.listOwned(id, true).map((p) => ({
    symbol: p.symbol,
    side: p.side,
    volume: p.volume,
  }));
  const diff = snapshot
    ? diffBrokerCashAndPositions({
        ledgerBalance: accounting.ledgerBalance(id),
        brokerBalance: snapshot.balance,
        localPositions: local,
        brokerPositions: snapshot.positions,
      })
    : { cashDelta: null, positionDrift: [] as PositionDrift[] };
  const report: ForexBrokerReconciliationReport = {
    reportId: randomUUID(),
    accountId: id,
    ledgerBalance: accounting.ledgerBalance(id),
    brokerBalance: snapshot?.balance ?? null,
    cashDelta: diff.cashDelta,
    positionDrift: diff.positionDrift,
    status: snapshot ? 'OPEN' : 'UNAVAILABLE',
    persisted: false,
  };
  memory.set(report.reportId, report);
  try {
    await db.query(
      `INSERT INTO forex_broker_reconciliation_reports
         (report_id, account_id, ledger_balance, broker_balance, cash_delta, position_drift, status)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        report.reportId,
        report.accountId,
        report.ledgerBalance,
        report.brokerBalance,
        report.cashDelta,
        JSON.stringify(report.positionDrift),
        report.status,
      ]
    );
    report.persisted = true;
  } catch {
    report.persisted = false;
  }
  return report;
}

export async function applyForexBrokerReconciliation(
  reportId: string,
  confirm: boolean
): Promise<{ ok: true; applied: boolean; transactionId: string | null } | { ok: false; code: string; message: string }> {
  if (confirm !== true) {
    return { ok: false, code: 'RECONCILIATION_CONFIRM_REQUIRED', message: 'Cash adjustment requires confirm=true' };
  }
  const report = memory.get(reportId);
  if (!report) return { ok: false, code: 'REPORT_NOT_FOUND', message: 'Reconciliation report was not found' };
  if (report.status === 'APPLIED') return { ok: true, applied: false, transactionId: null };
  if (report.brokerBalance == null || report.cashDelta == null) {
    return { ok: false, code: 'BROKER_BALANCE_UNAVAILABLE', message: 'Refusing to invent cash without a broker balance' };
  }
  let delta;
  try {
    delta = fxDecimal(report.cashDelta);
  } catch {
    return { ok: false, code: 'BROKER_BALANCE_UNAVAILABLE', message: 'Cash delta is not a number' };
  }
  if (delta.eq(0)) {
    report.status = 'APPLIED';
    return { ok: true, applied: false, transactionId: null };
  }
  const pricing = getForexPricingService();
  const accounting = getForexAccountingService(getForexPositionService(pricing), pricing);
  const tx = await accounting.postAdminFinanceMovement({
    accountId: report.accountId,
    amount: delta.abs().toFixed(),
    direction: delta.gt(0) ? 'credit' : 'debit',
    idempotencyKey: `FOREX_BROKER_RECON:${report.reportId}`,
    ledgerType: 'ADJUSTMENT',
    referenceId: report.reportId,
    metadata: { rail: 'BROKER', source: 'RECONCILIATION' },
  });
  report.status = 'APPLIED';
  try {
    await db.query(
      `UPDATE forex_broker_reconciliation_reports SET status = 'APPLIED' WHERE report_id = $1::uuid`,
      [report.reportId]
    );
  } catch {
    /* the ledger post is the apply; the report row is the audit copy */
  }
  return { ok: true, applied: true, transactionId: tx.transactionId };
}
