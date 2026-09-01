/**
 * Public ledger presentation. Does not post, mutate, or invent balances.
 * Running balance is the CUSTOMER_CASH running sum — the same account used by
 * ForexLedgerService.customerCashBalance.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';
import { forexAccountingComponents } from './components.js';

export type PublicLedgerRow = {
  transactionId: string;
  type: string;
  debit: string;
  credit: string;
  cashDebit: string;
  cashCredit: string;
  net: string;
  currency: string;
  reference: Record<string, unknown>;
  timestamp: string;
  status: string;
  source: string;
  balanceBefore: string;
  balanceAfter: string;
};

export type PublicLedgerReconciliation = {
  currency: string;
  openingBalance: string;
  deposits: string;
  withdrawals: string;
  realizedPnl: string;
  fees: string;
  swaps: string;
  adjustments: string;
  ledgerFromComponents: string;
  ledgerBalance: string;
  status: 'MATCH' | 'MISMATCH';
};

function cashSides(tx: ForexLedgerTransaction): { cashDebit: ReturnType<typeof fxDecimal>; cashCredit: ReturnType<typeof fxDecimal> } {
  let cashDebit = fxDecimal(0);
  let cashCredit = fxDecimal(0);
  for (const e of tx.entries) {
    if (e.ledgerAccount !== 'CUSTOMER_CASH') continue;
    cashDebit = cashDebit.plus(e.debit);
    cashCredit = cashCredit.plus(e.credit);
  }
  return { cashDebit, cashCredit };
}

function relationRefs(tx: ForexLedgerTransaction): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(tx.metadata ?? {}) };
  for (const e of tx.entries) {
    if (e.referenceType === 'FILL' && e.referenceId) out.fillId = out.fillId ?? e.referenceId;
    if (e.referenceType === 'ORDER' && e.referenceId) out.orderId = out.orderId ?? e.referenceId;
    if (e.referenceType === 'POSITION' && e.referenceId) out.positionId = out.positionId ?? e.referenceId;
  }
  return out;
}

export function publicLedgerRow(tx: ForexLedgerTransaction): Omit<PublicLedgerRow, 'balanceBefore' | 'balanceAfter'> {
  const { cashDebit, cashCredit } = cashSides(tx);
  const debit = tx.entries.reduce((a, e) => a.plus(e.debit), fxDecimal(0)).toFixed();
  const credit = tx.entries.reduce((a, e) => a.plus(e.credit), fxDecimal(0)).toFixed();
  return {
    transactionId: tx.transactionId,
    type: tx.type,
    debit,
    credit,
    cashDebit: cashDebit.toFixed(),
    cashCredit: cashCredit.toFixed(),
    net: cashCredit.minus(cashDebit).toFixed(),
    currency: tx.currency,
    reference: relationRefs(tx),
    timestamp: tx.createdAt,
    status: tx.status,
    source: tx.source,
  };
}

/** Chronological CUSTOMER_CASH running sum, returned newest-first. */
export function publicLedgerTrail(txs: ForexLedgerTransaction[]): PublicLedgerRow[] {
  const chrono = [...txs].sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    return t !== 0 ? t : a.transactionId.localeCompare(b.transactionId);
  });
  let bal = fxDecimal(0);
  const rows: PublicLedgerRow[] = [];
  for (const tx of chrono) {
    const base = publicLedgerRow(tx);
    const before = bal;
    bal = bal.plus(base.net);
    rows.push({
      ...base,
      balanceBefore: before.toFixed(),
      balanceAfter: bal.toFixed(),
    });
  }
  return rows.reverse();
}

export function publicLedgerReconciliation(
  txs: ForexLedgerTransaction[],
  ledgerBalance: string,
  currency: string
): PublicLedgerReconciliation {
  const c = forexAccountingComponents(txs);
  const match = fxDecimal(c.ledgerFromComponents).eq(fxDecimal(ledgerBalance));
  return {
    currency,
    openingBalance: '0',
    deposits: c.deposits,
    withdrawals: c.withdrawals,
    realizedPnl: c.realizedPnl,
    fees: c.fees,
    swaps: c.swaps,
    adjustments: c.adjustments,
    ledgerFromComponents: c.ledgerFromComponents,
    ledgerBalance,
    status: match ? 'MATCH' : 'MISMATCH',
  };
}
