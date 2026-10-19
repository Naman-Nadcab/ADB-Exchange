/**
 * Single Forex valuation policy for executable risk / liquidation math.
 *
 * Open-position close prices:
 *   LONG  → BID  (sell to close)
 *   SHORT → ASK  (buy to close)
 *
 * Mid is never used for liquidation-critical equity or executable exposure.
 * Used margin charges only unmatched lots. A fully hedged symbol (equal
 * long and short volume) uses zero margin. Customer-facing ledger authority
 * is unchanged.
 *
 * Crypto balances are out of scope.
 */
export const FOREX_VALUATION_POLICY = {
  longExecutableClose: 'BID',
  shortExecutableClose: 'ASK',
  usedMargin: 'UNMATCHED_LOTS_ONLY',
  equity: 'CUSTOMER_CASH + CUSTOMER_CREDIT + UNREALIZED_PNL',
  freeMargin: 'EQUITY - USED_MARGIN',
  availableBalance: 'FREE_MARGIN',
  midNeverDrivesLiquidationEquity: true,
  source: 'SIMULATED',
} as const;
