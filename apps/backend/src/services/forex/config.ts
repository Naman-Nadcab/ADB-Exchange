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
  degradedErrorRate: 0.05,
} as const;
