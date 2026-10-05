/**
 * Forex domain config. Reads process.env only.
 * Do not import apps/backend/src/config — that schema is Crypto-owned.
 *
 * Optional env (all have safe defaults; no secrets required for Phase 1 mock):
 *   FOREX_MARKET_DATA_ENABLED
 *   FOREX_QUOTE_STALE_MS
 *   FOREX_QUOTE_PROVIDER_STALE_MS
 *   FOREX_QUOTE_OFFLINE_MS
 *   FOREX_QUOTE_MAX_FUTURE_SKEW_MS
 *   FOREX_MARKET_DATA_INTERVAL_MS
 *   FOREX_QUOTE_TICKS_PERSIST
 *   FOREX_BROKER_BASE_URL   (unset → live forex stays fail-closed)
 *   FOREX_BROKER_API_KEY
 */

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const forexConfig = {
  marketDataEnabled: envBool('FOREX_MARKET_DATA_ENABLED', true),
  /** Received-age above this is never treated as fresh. */
  quoteStaleMs: envInt('FOREX_QUOTE_STALE_MS', 2000),
  /** Provider-timestamp age above this is never treated as fresh. */
  quoteProviderStaleMs: envInt('FOREX_QUOTE_PROVIDER_STALE_MS', 3000),
  /** No quote for this long → provider OFFLINE. */
  quoteOfflineMs: envInt('FOREX_QUOTE_OFFLINE_MS', 10_000),
  /** Reject provider timestamps too far in the future. */
  maxFutureSkewMs: envInt('FOREX_QUOTE_MAX_FUTURE_SKEW_MS', 2000),
  marketDataIntervalMs: envInt('FOREX_MARKET_DATA_INTERVAL_MS', 250),
  /** Phase 1 default: latest-only. Tick history table exists for later replay. */
  persistQuoteTicks: envBool('FOREX_QUOTE_TICKS_PERSIST', false),
  /** Latest forex_quotes / forex_lp_quotes rows — off by default (MOCK ticks are in-memory). */
  persistLatestQuotes: envBool('FOREX_PERSIST_LATEST_QUOTES', false),
  degradedErrorRate: 0.05,
  /** Venue placeOrder timeout. */
  executionTimeoutMs: envInt('FOREX_EXECUTION_TIMEOUT_MS', 1500),
  /** Default max |requested-expected| in price units. */
  defaultMaxDeviation: process.env.FOREX_DEFAULT_MAX_DEVIATION?.trim() || '0.00100',
  /** Default max slippage in price units. */
  defaultMaxSlippage: process.env.FOREX_DEFAULT_MAX_SLIPPAGE?.trim() || '0.00030',
  executionTestApiEnabled: envBool('FOREX_EXECUTION_TEST_API', false),
  /** Active position mode. HEDGING is reserved; keying stays mode-aware. */
  positionMode: (process.env.FOREX_POSITION_MODE?.trim().toUpperCase() === 'HEDGING' ? 'HEDGING' : 'NETTING') as
    | 'NETTING'
    | 'HEDGING',
  globalMaxLeverage: process.env.FOREX_GLOBAL_MAX_LEVERAGE?.trim() || '100',
  defaultAccountLeverage: process.env.FOREX_DEFAULT_ACCOUNT_LEVERAGE?.trim() || '50',
  /** maintenance = initial * this ratio. */
  maintenanceRatio: process.env.FOREX_MAINTENANCE_RATIO?.trim() || '0.50',
  /** Margin level % thresholds (equity/used*100). */
  marginWarningLevel: process.env.FOREX_MARGIN_WARNING_LEVEL?.trim() || '150',
  marginCallLevel: process.env.FOREX_MARGIN_CALL_LEVEL?.trim() || '100',
  stopOutLevel: process.env.FOREX_STOP_OUT_LEVEL?.trim() || '50',
  /**
   * Fallback only when no Forex ledger is attached (Phase 5 tests).
   * Phase 6 account views use posted CUSTOMER_CASH, not this value.
   */
  simulatedBalanceReference: process.env.FOREX_SIMULATED_BALANCE_REF?.trim() || '100000',
  /** Sole Phase 6 accounting currency. Do not mix. */
  accountingCurrency: 'USD',
  maxPositionVolume: process.env.FOREX_MAX_POSITION_VOLUME?.trim() || '50',
  maxOrderVolume: process.env.FOREX_MAX_ORDER_VOLUME?.trim() || '20',
  maxSymbolExposure: process.env.FOREX_MAX_SYMBOL_EXPOSURE?.trim() || '100000000',
  maxTotalExposure: process.env.FOREX_MAX_TOTAL_EXPOSURE?.trim() || '500000000',
  maxMarginUtilization: process.env.FOREX_MAX_MARGIN_UTILIZATION?.trim() || '0.80',
  killSwitch: envBool('FOREX_KILL_SWITCH', false),
  /** Test-only Forex credit API. Cannot move real money. */
  fundingTestApiEnabled: envBool('FOREX_FUNDING_TEST_API', false),
  /**
   * Customer DEMO funding (SIMULATED/MOCK only). Credits Forex ledger only.
   * Never touches Crypto balances. Blocked when realForex would be enabled.
   */
  demoFundingEnabled: envBool('FOREX_DEMO_FUNDING', false),
  demoFundingDefaultAmount: process.env.FOREX_DEMO_FUNDING_AMOUNT?.trim() || '10000',
  /**
   * DEMO / MOCK only. Bid = Ask and spread = 0 at the quote source.
   * Defaults on when demo funding is enabled. Never applies to a real LP.
   */
  demoZeroSpread: envBool('FOREX_DEMO_ZERO_SPREAD', envBool('FOREX_DEMO_FUNDING', false)),
  /**
   * When true, UNCONFIGURED holiday coverage fail-closes customer trading.
   * Default false for MOCK: no invented holiday list; state stays explicit.
   */
  holidayRequired: envBool('FOREX_HOLIDAY_REQUIRED', false),
  /** Admin routing desk v2 + richer symbol routing visibility (default off). */
  routingV2Enabled: envBool('FOREX_ROUTING_V2', false),
  /** Pre-routing health check on default broker adapter (default off). */
  adapterLayerHookEnabled: envBool('FOREX_ADAPTER_LAYER_HOOK', false),
} as const;
