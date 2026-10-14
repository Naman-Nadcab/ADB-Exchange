/**
 * Unified last-price resolution for spot tickers (REST bulk + per-symbol + WS hydrate).
 * Display last prefers a fresh oracle. Execution stays on the internal book:
 * an oracle price is never a fill.
 */

/** Drop a 24h high/low/open that is not a real print near the displayed last. */
export function referenceStatNearLast(
  stat: string | null | undefined,
  last: string | null | undefined,
  band = 0.25
): string | null {
  if (stat == null || stat === '' || stat === '0') return null;
  const n = Number(stat);
  if (!Number.isFinite(n) || n <= 0) return null;
  const l = Number(last ?? '');
  if (!Number.isFinite(l) || l <= 0) return String(stat);
  if (Math.abs(n - l) / l > band) return null;
  return String(stat);
}

export type SpotLastPriceSource = 'oracle' | 'trade' | 'candle' | 'none';

export type SpotLastPriceInput = {
  symbol: string;
  oraclePrice?: string | null;
  oracleUpdatedAt?: string | Date | null;
  marketLastPrice?: string | null;
  marketLastUpdatedAt?: string | Date | null;
  tradeLastPrice?: string | null;
  tradeLastPriceAt?: string | Date | null;
  candle1mLastPrice?: string | null;
  previousLastPrice?: string | null;
};

export type SpotLastPriceResult = {
  last_price: string | null;
  last_price_source: SpotLastPriceSource;
  last_price_age_ms: number | null;
  last_price_stale: boolean;
};

const TRADE_FRESH_MS = 5 * 60_000;
const TRADE_STALE_WARN_MS = 60_000;
const ORACLE_FRESH_MS = Number(process.env.SPOT_ORACLE_DISPLAY_MAX_AGE_MS || 90_000);

function parseAgeMs(ts: string | Date | null | undefined): number | null {
  if (!ts) return null;
  const ms = ts instanceof Date ? ts.getTime() : Date.parse(String(ts));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Date.now() - ms);
}

function validPrice(p: string | null | undefined): string | null {
  if (p == null || p === '') return null;
  const n = Number(p);
  return Number.isFinite(n) && n > 0 ? p : null;
}

/**
 * Priority:
 * 1. Fresh oracle (market_prices) — display reference, not a fill
 * 2. Fresh internal trade / market last
 * 3. 1m candle close
 * 4. Previous snapshot
 */
export function resolveSpotLastPrice(input: SpotLastPriceInput): SpotLastPriceResult {
  const oracle = validPrice(input.oraclePrice);
  const oracleAge = parseAgeMs(input.oracleUpdatedAt);
  const oracleFresh = oracle != null && oracleAge != null && oracleAge <= ORACLE_FRESH_MS;

  const trade = validPrice(input.tradeLastPrice);
  const tradeAge = parseAgeMs(input.tradeLastPriceAt);
  const tradeFresh = trade != null && tradeAge != null && tradeAge <= TRADE_FRESH_MS;

  const marketLast = validPrice(input.marketLastPrice);
  const marketAge = parseAgeMs(input.marketLastUpdatedAt);
  const marketFresh = marketLast != null && marketAge != null && marketAge <= TRADE_FRESH_MS;

  const candle = validPrice(input.candle1mLastPrice);
  const prev = validPrice(input.previousLastPrice);

  if (oracleFresh && oracle) {
    return {
      last_price: oracle,
      last_price_source: 'oracle',
      last_price_age_ms: oracleAge,
      last_price_stale: oracleAge != null && oracleAge > TRADE_STALE_WARN_MS,
    };
  }

  if (marketFresh && marketLast) {
    return {
      last_price: marketLast,
      last_price_source: 'trade',
      last_price_age_ms: marketAge,
      last_price_stale: marketAge != null && marketAge > TRADE_STALE_WARN_MS,
    };
  }

  if (tradeFresh && trade) {
    return {
      last_price: trade,
      last_price_source: 'trade',
      last_price_age_ms: tradeAge,
      last_price_stale: tradeAge != null && tradeAge > TRADE_STALE_WARN_MS,
    };
  }

  if (oracle) {
    return {
      last_price: oracle,
      last_price_source: 'oracle',
      last_price_age_ms: oracleAge,
      last_price_stale: true,
    };
  }

  if (candle) {
    return {
      last_price: candle,
      last_price_source: 'candle',
      last_price_age_ms: null,
      last_price_stale: true,
    };
  }

  if (trade) {
    return {
      last_price: trade,
      last_price_source: 'trade',
      last_price_age_ms: tradeAge,
      last_price_stale: true,
    };
  }

  if (prev) {
    return {
      last_price: prev,
      last_price_source: 'candle',
      last_price_age_ms: null,
      last_price_stale: true,
    };
  }

  return {
    last_price: null,
    last_price_source: 'none',
    last_price_age_ms: null,
    last_price_stale: false,
  };
}
