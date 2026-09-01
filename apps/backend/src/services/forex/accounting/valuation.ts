/**
 * Single Forex valuation policy for executable risk / liquidation math.
 *
 * Open-position close prices:
 *   LONG  → BID  (sell to close)
 *   SHORT → ASK  (buy to close)
 *
 * Mid is never used for liquidation-critical equity or executable exposure.
 * Initial / used margin remains the sum of open-position initial margins
 * (entry-based). Customer-facing ledger authority is unchanged.
 *
 * Crypto balances are out of scope.
 */
export const FOREX_VALUATION_POLICY = {
  longExecutableClose: 'BID',
  shortExecutableClose: 'ASK',
  usedMargin: 'SUM_INITIAL_MARGIN_OPEN',
  equity: 'CUSTOMER_CASH + UNREALIZED_PNL',
  freeMargin: 'EQUITY - USED_MARGIN',
  availableBalance: 'FREE_MARGIN',
  midNeverDrivesLiquidationEquity: true,
  source: 'SIMULATED',
} as const;
