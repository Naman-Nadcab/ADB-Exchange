/**
 * Separate Forex accounting components. Fees and swaps are never folded into P&L.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';

export function sumCustomerCashByType(txs: ForexLedgerTransaction[], type: ForexLedgerTransaction['type']): string {
  let sum = fxDecimal(0);
  for (const tx of txs) {
    if (tx.type !== type) continue;
    for (const e of tx.entries) {
      if (e.ledgerAccount !== 'CUSTOMER_CASH') continue;
      sum = sum.plus(e.credit).minus(e.debit);
    }
  }
  return sum.toFixed();
}

export function forexAccountingComponents(txs: ForexLedgerTransaction[]): {
  deposits: string;
  withdrawals: string;
  realizedPnl: string;
  fees: string;
  swaps: string;
  ledgerFromComponents: string;
} {
  const deposits = fxDecimal(sumCustomerCashByType(txs, 'DEPOSIT')).plus(sumCustomerCashByType(txs, 'INITIAL_FUNDING'));
  const withdrawals = fxDecimal(sumCustomerCashByType(txs, 'WITHDRAWAL'));
  const realizedPnl = fxDecimal(sumCustomerCashByType(txs, 'REALIZED_PNL'));
  const fees = fxDecimal(sumCustomerCashByType(txs, 'FEE'));
  const swaps = fxDecimal(sumCustomerCashByType(txs, 'FUNDING'));
  const adjustments = fxDecimal(sumCustomerCashByType(txs, 'ADJUSTMENT')).plus(sumCustomerCashByType(txs, 'REVERSAL'));
  return {
    deposits: deposits.toFixed(),
    withdrawals: withdrawals.toFixed(),
    realizedPnl: realizedPnl.toFixed(),
    fees: fees.toFixed(),
    swaps: swaps.toFixed(),
    ledgerFromComponents: deposits.plus(withdrawals).plus(realizedPnl).plus(fees).plus(swaps).plus(adjustments).toFixed(),
  };
}
