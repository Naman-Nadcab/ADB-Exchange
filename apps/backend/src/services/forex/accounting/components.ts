/**
 * Separate Forex accounting components. Fees and swaps are never folded into P&L.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';

export function sumCustomerCashByType(
  txs: ForexLedgerTransaction[],
  type: ForexLedgerTransaction['type'],
  accountId?: string
): string {
  let sum = fxDecimal(0);
  for (const tx of txs) {
    if (tx.type !== type) continue;
    for (const e of tx.entries) {
      if (e.ledgerAccount !== 'CUSTOMER_CASH') continue;
      if (accountId && e.accountId !== accountId) continue;
      sum = sum.plus(e.credit).minus(e.debit);
    }
  }
  return sum.toFixed();
}

export function forexAccountingComponents(
  txs: ForexLedgerTransaction[],
  accountId?: string
): {
  deposits: string;
  withdrawals: string;
  realizedPnl: string;
  fees: string;
  swaps: string;
  adjustments: string;
  transfers: string;
  ledgerFromComponents: string;
} {
  const deposits = fxDecimal(sumCustomerCashByType(txs, 'DEPOSIT', accountId)).plus(
    sumCustomerCashByType(txs, 'INITIAL_FUNDING', accountId)
  );
  const withdrawals = fxDecimal(sumCustomerCashByType(txs, 'WITHDRAWAL', accountId));
  const realizedPnl = fxDecimal(sumCustomerCashByType(txs, 'REALIZED_PNL', accountId));
  const fees = fxDecimal(sumCustomerCashByType(txs, 'FEE', accountId));
  const swaps = fxDecimal(sumCustomerCashByType(txs, 'FUNDING', accountId));
  const adjustments = fxDecimal(sumCustomerCashByType(txs, 'ADJUSTMENT', accountId)).plus(
    sumCustomerCashByType(txs, 'REVERSAL', accountId)
  );
  const transfers = fxDecimal(sumCustomerCashByType(txs, 'TRANSFER', accountId));
  return {
    deposits: deposits.toFixed(),
    withdrawals: withdrawals.toFixed(),
    realizedPnl: realizedPnl.toFixed(),
    fees: fees.toFixed(),
    swaps: swaps.toFixed(),
    adjustments: adjustments.toFixed(),
    transfers: transfers.toFixed(),
    ledgerFromComponents: deposits
      .plus(withdrawals)
      .plus(realizedPnl)
      .plus(fees)
      .plus(swaps)
      .plus(adjustments)
      .plus(transfers)
      .toFixed(),
  };
}
