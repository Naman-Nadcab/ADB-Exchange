/**
 * Forex funding boundary.
 *
 * Crypto funds ≠ Forex funds.
 * user_balances / balance_ledger are never Forex accounting authority.
 * Forex equity comes only from the Forex ledger + open-position valuation.
 *
 * This phase does not implement payment rails or Crypto-to-Forex transfers.
 * Deposits/credits exist only as ledger concepts (simulated test rail).
 */
export const FOREX_FUNDS_AUTHORITY = 'forex_ledger' as const;
export const CRYPTO_FUNDS_AUTHORITY = 'user_balances' as const;

export const FOREX_EQUITY_MODEL = {
  /** CUSTOMER_CASH credits − debits (includes realized, fees, swaps, simulated deposits). */
  ledgerBalance: 'forex_ledger.CUSTOMER_CASH',
  realizedPnl: 'forex_ledger.REALIZED_PNL (posted from closing fills only)',
  unrealizedPnl: 'open positions × authoritative BID(long)/ASK(short)',
  fees: 'forex_ledger.FEE (separate from P&L)',
  swaps: 'forex_ledger.FUNDING (overnight swap, separate from P&L)',
  equity: 'ledgerBalance + unrealizedPnl',
  freeMargin: 'equity − usedMargin',
} as const;

export function assertNotCryptoLedger(table: string): void {
  if (table === 'user_balances' || table === 'balance_ledger') {
    throw new Error('FOREX_CRYPTO_BOUNDARY: Crypto tables are not Forex accounting authority');
  }
}
