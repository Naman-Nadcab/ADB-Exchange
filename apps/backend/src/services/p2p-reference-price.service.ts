/**
 * Backend P2P reference price: internal spot last trade with Redis cache.
 * Price is quote (fiat/stable) per 1 unit of base asset (e.g. INR per USDT).
 *
 * Resolution order:
 *   1. Redis cache (short TTL)
 *   2. Stablecoin parity (USDT/USD, USDT/USDT → 1)
 *   3. Last price from internal spot_trades
 *   4. USD reference from the USDT oracle when that fiat has no market (USDT/USDC = 1)
 *   5. Configured fallback rates (P2P_REFERENCE_FALLBACK_* env or p2p_reference_rates table).
 *      Production should wire a real oracle here; dev uses the fallback map.
 */

import { Decimal, type DecimalInstance } from '../lib/decimal.js';
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { getSpotMarketsHasLastPrice, getSpotTradesUseMarket } from '../lib/spot-schema-cache.js';

const CACHE_PREFIX = 'p2p:ref:';
const MAX_TRADE_PRICE_AGE_MS = 30 * 60_000;
const MAX_MARKET_PRICE_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_SPOT_MARKET_PRICE_AGE_MS = 6 * 60 * 60_000;
const MAX_CANDLE_PRICE_AGE_MS = 48 * 60 * 60_000;
const MEDIAN_WINDOW_TRADES = 25;

/**
 * Dev-mode fallback map for pairs where no internal market exists yet.
 * Read from env `P2P_REFERENCE_FALLBACK_<ASSET>_<FIAT>` or falls back to this baseline.
 * NOTE: In production replace with a real price oracle (Binance ticker, Coingecko, etc.).
 */
const FALLBACK_RATES: Record<string, string> = {
  USDT_INR: '83',
  USDC_INR: '83',
  BTC_INR: '5500000',
  ETH_INR: '280000',
};

function fallbackRate(asset: string, fiat: string): string | null {
  const k = `${asset.toUpperCase()}_${fiat.toUpperCase()}`;
  const envKey = `P2P_REFERENCE_FALLBACK_${k}`;
  const envVal = process.env[envKey];
  // An operator-configured fallback is always honored (explicit, auditable choice).
  if (envVal) return envVal;
  // H-4 FIX: fail closed in production. Never serve the hardcoded dev baseline rates (83, 5500000, …)
  // for real P2P pricing — that would let trades execute against a stale/fabricated price when live
  // data is missing. Production must rely on live spot data or an explicit P2P_REFERENCE_FALLBACK_* /
  // oracle; otherwise getP2PReferencePrice() throws and the caller surfaces "price unavailable".
  if (process.env.NODE_ENV === 'production') return null;
  return FALLBACK_RATES[k] || null;
}

/** USD reference is the USDT oracle (stablecoins are 1). Used when the asked fiat has no market. */
async function usdOracleReference(asset: string): Promise<{ price: string; market: string | null } | null> {
  if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') {
    return { price: '1', market: null };
  }
  const via = await resolveDirectReferencePrice(asset, 'USDT');
  if (!via.price) return null;
  try {
    const price = new Decimal(via.price).toDecimalPlaces(18, Decimal.ROUND_DOWN).toString();
    if (!new Decimal(price).greaterThan(0)) return null;
    return { price, market: via.market };
  } catch {
    return null;
  }
}

function cacheKey(asset: string, fiat: string): string {
  return `${CACHE_PREFIX}${asset.toUpperCase()}:${fiat.toUpperCase()}`;
}

/** Candidate spot `market` strings (spot_trades.market) for base/fiat pair. */
export function spotMarketCandidates(baseSymbol: string, fiat: string): string[] {
  const b = baseSymbol.toUpperCase().trim();
  const f = fiat.toUpperCase().trim();
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  push(`${b}_${f}`);
  push(`${b}${f}`);
  push(`${b}-${f}`);
  if (f === 'USD' || f === 'USDT') {
    push(`${b}_USDT`);
    push(`${b}_USD`);
    push(`${b}USDT`);
  }
  if (b === 'USDT' && (f === 'USD' || f === 'USDT')) {
    push('USDT_USDT');
    push('USDT_USD');
  }
  return out;
}

async function robustRecentTradePrice(market: string): Promise<string | null> {
  try {
    const useMarket = await getSpotTradesUseMarket();
    // spot_trades uses trading_pair_id; resolve via trading_pairs.symbol.
    // Use recent-trade median (not single last trade) to reduce outlier impact.
    const r = useMarket
      ? await db.query<{ p: string; created_at: string }>(
          `SELECT st.price::text AS p, st.created_at::text AS created_at
         FROM spot_trades st
         WHERE st.market = $1
         ORDER BY st.created_at DESC
         LIMIT $2`,
          [market, MEDIAN_WINDOW_TRADES]
        )
      : await db.query<{ p: string; created_at: string }>(
          `SELECT st.price::text AS p, st.created_at::text AS created_at
       FROM spot_trades st
       INNER JOIN trading_pairs tp ON tp.id = st.trading_pair_id
       WHERE tp.symbol = $1
       ORDER BY st.created_at DESC
       LIMIT $2`,
          [market, MEDIAN_WINDOW_TRADES]
        );
    if (!r.rows.length) return null;
    const newestTs = Date.parse(String(r.rows[0]!.created_at));
    if (!Number.isFinite(newestTs) || Date.now() - newestTs > MAX_TRADE_PRICE_AGE_MS) {
      return null;
    }
    const vals = r.rows
      .map((row) => {
        const d = new Decimal(row.p);
        return d.isFinite() && d.greaterThan(0) ? d : null;
      })
      .filter((x): x is DecimalInstance => x != null)
      .sort((a, b) => (a.lessThan(b) ? -1 : a.greaterThan(b) ? 1 : 0));
    if (!vals.length) return null;
    const mid = Math.floor(vals.length / 2);
    const median = vals.length % 2 === 0 ? vals[mid - 1]!.plus(vals[mid]!).div(2) : vals[mid]!;
    return median.toDecimalPlaces(18, Decimal.ROUND_DOWN).toString();
  } catch {
    return null;
  }
}

async function latestMarketPrice(market: string): Promise<string | null> {
  try {
    const r = await db.query<{ p: string | null; ts: string | null }>(
      `SELECT mp.price::text AS p, mp.last_updated::text AS ts
       FROM market_prices mp
       JOIN spot_markets sm
         ON sm.base_currency_id = mp.base_currency_id
        AND sm.quote_currency_id = mp.quote_currency_id
       WHERE sm.symbol = $1
       LIMIT 1`,
      [market]
    );
    const row = r.rows[0];
    if (!row?.p) return null;
    const ts = row.ts ? Date.parse(String(row.ts)) : NaN;
    if (!Number.isFinite(ts) || Date.now() - ts > MAX_MARKET_PRICE_AGE_MS) return null;
    const d = new Decimal(row.p);
    return d.isFinite() && d.greaterThan(0) ? d.toDecimalPlaces(18, Decimal.ROUND_DOWN).toString() : null;
  } catch {
    return null;
  }
}

async function latestSpotMarketLastPrice(market: string): Promise<string | null> {
  try {
    const hasLastPrice = await getSpotMarketsHasLastPrice();
    if (!hasLastPrice) return null;
    const r = await db.query<{ p: string | null; ts: string | null }>(
      `SELECT sm.last_price::text AS p, sm.updated_at::text AS ts
       FROM spot_markets sm
       WHERE sm.symbol = $1
       LIMIT 1`,
      [market]
    );
    const row = r.rows[0];
    if (!row?.p) return null;
    const ts = row.ts ? Date.parse(String(row.ts)) : NaN;
    if (!Number.isFinite(ts) || Date.now() - ts > MAX_SPOT_MARKET_PRICE_AGE_MS) return null;
    const d = new Decimal(row.p);
    return d.isFinite() && d.greaterThan(0) ? d.toDecimalPlaces(18, Decimal.ROUND_DOWN).toString() : null;
  } catch {
    return null;
  }
}

async function latest1mCandlePrice(market: string): Promise<string | null> {
  try {
    const r = await db.query<{ p: string | null; ts: string | null }>(
      `SELECT oc.close_price::text AS p, oc.open_time::text AS ts
       FROM ohlcv_candles oc
       JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
       WHERE tp.symbol = $1
         AND oc.interval_type = '1m'
       ORDER BY oc.open_time DESC
       LIMIT 1`,
      [market]
    );
    const row = r.rows[0];
    if (!row?.p) return null;
    const ts = row.ts ? Date.parse(String(row.ts)) : NaN;
    if (!Number.isFinite(ts) || Date.now() - ts > MAX_CANDLE_PRICE_AGE_MS) return null;
    const d = new Decimal(row.p);
    return d.isFinite() && d.greaterThan(0) ? d.toDecimalPlaces(18, Decimal.ROUND_DOWN).toString() : null;
  } catch {
    return null;
  }
}

async function resolveDirectReferencePrice(asset: string, fiat: string): Promise<{ market: string | null; price: string | null }> {
  const candidates = spotMarketCandidates(asset, fiat);
  for (const m of candidates) {
    const spotMarketPrice = await latestSpotMarketLastPrice(m);
    if (spotMarketPrice && new Decimal(spotMarketPrice).greaterThan(0)) {
      return { market: m, price: spotMarketPrice };
    }
    const mkt = await latestMarketPrice(m);
    if (mkt && new Decimal(mkt).greaterThan(0)) {
      return { market: m, price: mkt };
    }
    const candle = await latest1mCandlePrice(m);
    if (candle && new Decimal(candle).greaterThan(0)) {
      return { market: m, price: candle };
    }
    const p = await robustRecentTradePrice(m);
    if (p && new Decimal(p).greaterThan(0)) {
      return { market: m, price: p };
    }
  }
  return { market: null, price: null };
}

export type P2PReferencePriceResult = {
  asset: string;
  fiat: string;
  reference_price: string;
  market: string | null;
  source: 'spot_trade' | 'stablecoin_parity' | 'cache' | 'fallback' | 'usd_reference';
  updated_at: string;
};

/**
 * Resolve reference price (fiat per 1 crypto) from spot trades; cache in Redis.
 */
export async function getP2PReferencePrice(asset: string, fiat: string): Promise<P2PReferencePriceResult> {
  const a = asset.toUpperCase().trim();
  const f = fiat.toUpperCase().trim();
  const ttl = config.p2p.referencePriceTtlSec;
  const ck = cacheKey(a, f);

  if (ttl > 0) {
    const cached = await redis.getJson<P2PReferencePriceResult>(ck);
    if (cached?.reference_price) {
      return { ...cached, source: 'cache' };
    }
  }

  if (a === 'USDT' && (f === 'USD' || f === 'USDT')) {
    const res: P2PReferencePriceResult = {
      asset: a,
      fiat: f,
      reference_price: '1',
      market: null,
      source: 'stablecoin_parity',
      updated_at: new Date().toISOString(),
    };
    if (ttl > 0) await redis.setJson(ck, res, ttl);
    return res;
  }

  let { market: usedMarket, price: priceStr } = await resolveDirectReferencePrice(a, f);

  // Common path: derive BTC/INR, ETH/INR, ... through USDT when direct pair is absent.
  if (!priceStr && a !== 'USDT' && f !== 'USDT') {
    const viaUsdt = await resolveDirectReferencePrice(a, 'USDT');
    if (viaUsdt.price) {
      const usdtToFiat = await resolveDirectReferencePrice('USDT', f);
      const usdtFiat = usdtToFiat.price ?? fallbackRate('USDT', f);
      if (usdtFiat) {
        try {
          const derived = new Decimal(viaUsdt.price).times(new Decimal(usdtFiat));
          if (derived.isFinite() && derived.greaterThan(0)) {
            priceStr = derived.toDecimalPlaces(18, Decimal.ROUND_DOWN).toString();
            usedMarket = `${viaUsdt.market ?? `${a}_USDT`} × ${usdtToFiat.market ?? `USDT_${f}`}`;
          }
        } catch {
          /* fall through to configured fallback */
        }
      }
    }
  }

  if (!priceStr) {
    const usd = await usdOracleReference(a);
    if (usd) {
      const usdRes: P2PReferencePriceResult = {
        asset: a,
        fiat: 'USD',
        reference_price: usd.price,
        market: usd.market,
        source: 'usd_reference',
        updated_at: new Date().toISOString(),
      };
      if (ttl > 0) await redis.setJson(ck, usdRes, ttl);
      return usdRes;
    }
    const fb = fallbackRate(a, f);
    if (fb) {
      logger.info('P2P reference price: using configured fallback rate (no internal market)', {
        asset: a,
        fiat: f,
        rate: fb,
      });
      const fbRes: P2PReferencePriceResult = {
        asset: a,
        fiat: f,
        reference_price: new Decimal(fb).toDecimalPlaces(18, Decimal.ROUND_DOWN).toString(),
        market: null,
        source: 'fallback',
        updated_at: new Date().toISOString(),
      };
      if (ttl > 0) await redis.setJson(ck, fbRes, ttl);
      return fbRes;
    }
    logger.warn('P2P reference price: no spot market and no fallback', {
      asset: a,
      fiat: f,
      candidates: spotMarketCandidates(a, f),
    });
    throw new Error(`No reference price for ${a}/${f}. Seed a spot market, wire an oracle, or set P2P_REFERENCE_FALLBACK_${a}_${f}.`);
  }

  const res: P2PReferencePriceResult = {
    asset: a,
    fiat: f,
    reference_price: new Decimal(priceStr).toDecimalPlaces(18, Decimal.ROUND_DOWN).toString(),
    market: usedMarket,
    source: 'spot_trade',
    updated_at: new Date().toISOString(),
  };
  if (ttl > 0) await redis.setJson(ck, res, ttl);
  return res;
}

/** Decimal reference for order/ad math (throws if unavailable). */
export async function getP2PReferencePriceDecimal(asset: string, fiat: string): Promise<DecimalInstance> {
  const r = await getP2PReferencePrice(asset, fiat);
  const d = new Decimal(r.reference_price);
  if (!d.isFinite() || d.lessThanOrEqualTo(0)) {
    throw new Error('Invalid reference price');
  }
  return d;
}

/**
 * Ad/order price from reference and margin percent (margin is percent points, e.g. 2 => +2%).
 */
export function applyFloatingMargin(reference: DecimalInstance, marginPercent: string | number): string {
  const m = new Decimal(marginPercent);
  const mult = new Decimal(1).plus(m.div(100));
  return reference.times(mult).toDecimalPlaces(18, Decimal.ROUND_DOWN).toString();
}
