/**
 * Shared DB reads for spot ticker (REST + WS subscribe snapshot).
 * Uses same schema branching as GET /spot/ticker/:symbol (market vs trading_pair_id).
 * When no trades: last_price prefers latest 1m candle close (same series as default chart), then oracle, then any candle.
 */
import { db } from './database.js';
import { getSpotMarketsHasLastPrice, getSpotTradesUseMarket } from './spot-schema-cache.js';
import { resolveSpotLastPrice, type SpotLastPriceSource } from './spot-ticker-price-resolve.js';

export type SpotTickerDbStats = {
  last_price: string | null;
  bid: string | null;
  ask: string | null;
  high_24h: string | null;
  low_24h: string | null;
  volume_24h: string;
  base_volume_24h: string;
  open_24h: string | null;
  last_trade_created_at: string | null;
  last_price_source: SpotLastPriceSource;
  last_price_age_ms: number | null;
  last_price_stale: boolean;
};

const TRADE_STALE_WARN_MS = 60_000;
const TRADE_STALE_CUTOFF_MS = 5 * 60_000;
const CANDLE_1M_STALE_CUTOFF_MS = 48 * 60 * 60_000;
const CANDLE_1D_STALE_CUTOFF_MS = 36 * 60 * 60_000;
const SPOT_MARKET_LAST_PRICE_MAX_AGE_MS = 6 * 60 * 60_000;
const STALE_TRADE_FALLBACK_MAX_AGE_MS = 30 * 60_000;
const RECENT_TRADES_WINDOW = 25;
const LAST_TRADE_OUTLIER_GUARD_PCT = 0.25;

function sanitizeTopOfBook(
  symbol: string,
  bid: string | null,
  ask: string | null
): { bid: string | null; ask: string | null } {
  const b = bid != null && bid !== '' ? Number(bid) : NaN;
  const a = ask != null && ask !== '' ? Number(ask) : NaN;
  if (Number.isFinite(b) && Number.isFinite(a) && a < b) {
    // Guard public ticker payloads against crossed top-of-book snapshots.
    return { bid: null, ask: null };
  }
  return { bid, ask };
}

async function fallbackPrice(symbol: string): Promise<{ price: string | null; candleOpenTimeMs: number | null }> {
  /** Match default chart interval (GET /trading/candles … interval=60 → 1m) so ticker/header align with candle series. */
  const m1 = await db.query<{ close_price: string; open_time: string }>(
    `SELECT oc.close_price::text, oc.open_time::text FROM ohlcv_candles oc
     JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
     WHERE tp.symbol = $1 AND oc.interval_type = '1m'
     ORDER BY oc.open_time DESC LIMIT 1`,
    [symbol]
  );
  const row = m1.rows[0];
  if (!row?.close_price) return { price: null, candleOpenTimeMs: null };
  const openTimeMs = Date.parse(String(row.open_time));
  return {
    price: row.close_price,
    candleOpenTimeMs: Number.isFinite(openTimeMs) ? openTimeMs : null,
  };
}

async function fallbackMarketPrice(symbol: string): Promise<{ price: string | null; updatedAt: string | null }> {
  const hasLastPrice = await getSpotMarketsHasLastPrice();
  if (!hasLastPrice) return { price: null, updatedAt: null };
  const r = await db.query<{ p: string | null; ts: string | null }>(
    `SELECT last_price::text AS p, updated_at::text AS ts
     FROM spot_markets
     WHERE symbol = $1
     LIMIT 1`,
    [symbol]
  );
  const row = r.rows[0];
  const p = row?.p ?? null;
  const ts = row?.ts ?? null;
  const tsMs = ts ? Date.parse(String(ts)) : NaN;
  if (!Number.isFinite(tsMs) || Date.now() - tsMs > SPOT_MARKET_LAST_PRICE_MAX_AGE_MS) {
    return { price: null, updatedAt: ts };
  }
  const n = p != null ? Number(p) : NaN;
  return Number.isFinite(n) && n > 0 ? { price: p, updatedAt: ts } : { price: null, updatedAt: ts };
}

async function fallbackOraclePrice(symbol: string): Promise<{ price: string | null; updatedAt: string | null }> {
  const r = await db.query<{ price: string | null; last_updated: string | null }>(
    `SELECT mp.price::text AS price, mp.last_updated::text AS last_updated
     FROM market_prices mp
     JOIN spot_markets sm ON sm.base_currency_id = mp.base_currency_id AND sm.quote_currency_id = mp.quote_currency_id
     WHERE sm.symbol = $1
     LIMIT 1`,
    [symbol]
  );
  const row = r.rows[0];
  return { price: row?.price ?? null, updatedAt: row?.last_updated ?? null };
}

async function fallback24hStats(
  symbol: string
): Promise<{ high: string | null; low: string | null; open: string | null; volume: string | null; candleOpenTimeMs: number | null }> {
  const r = await db.query<{ open_price: string; high_price: string; low_price: string; volume: string; open_time: string }>(
    `SELECT oc.open_price::text, oc.high_price::text, oc.low_price::text, oc.volume::text, oc.open_time::text
     FROM ohlcv_candles oc JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
     WHERE tp.symbol = $1 AND oc.interval_type = '1d'
     ORDER BY oc.open_time DESC LIMIT 1`,
    [symbol]
  );
  const row = r.rows[0];
  if (!row) return { high: null, low: null, open: null, volume: null, candleOpenTimeMs: null };
  const openTimeMs = Date.parse(String(row.open_time));
  return {
    high: row.high_price,
    low: row.low_price,
    open: row.open_price,
    volume: row.volume,
    candleOpenTimeMs: Number.isFinite(openTimeMs) ? openTimeMs : null,
  };
}

export async function loadSpotTickerDbStats(symbol: string): Promise<SpotTickerDbStats> {
  const useMarket = await getSpotTradesUseMarket();

  const last = useMarket
    ? await db.query<{ price: string; created_at: string }>(
        `SELECT price::text, created_at FROM spot_trades WHERE market = $1 ORDER BY created_at DESC LIMIT 1`,
        [symbol]
      )
    : await db.query<{ price: string; created_at: string }>(
        `SELECT t.price::text, t.created_at FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 ORDER BY t.created_at DESC LIMIT 1`,
        [symbol]
      );
  const lr = last.rows[0];
  const lastTradeMs = lr?.created_at ? Date.parse(String(lr.created_at)) : NaN;
  const lastPriceAgeMs = Number.isFinite(lastTradeMs) ? Math.max(0, Date.now() - lastTradeMs) : null;
  const tradeFresh = lastPriceAgeMs != null && lastPriceAgeMs <= TRADE_STALE_CUTOFF_MS;
  const recentTrades = useMarket
    ? await db.query<{ price: string }>(
        `SELECT price::text
         FROM spot_trades
         WHERE market = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [symbol, RECENT_TRADES_WINDOW]
      )
    : await db.query<{ price: string }>(
        `SELECT t.price::text
         FROM spot_trades t
         JOIN trading_pairs tp ON t.trading_pair_id = tp.id
         WHERE tp.symbol = $1
         ORDER BY t.created_at DESC
         LIMIT $2`,
        [symbol, RECENT_TRADES_WINDOW]
      );
  const recentNums = recentTrades.rows
    .map((r) => Number(r.price))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const medianRecentTrade = recentNums.length
    ? (recentNums.length % 2 === 0
        ? (recentNums[recentNums.length / 2 - 1]! + recentNums[recentNums.length / 2]!) / 2
        : recentNums[Math.floor(recentNums.length / 2)]!)
    : null;
  const latestTradeNum = lr?.price != null ? Number(lr.price) : NaN;
  const latestTradeOutlier =
    Number.isFinite(latestTradeNum) &&
    latestTradeNum > 0 &&
    Number.isFinite(medianRecentTrade) &&
    medianRecentTrade != null &&
    Math.abs(latestTradeNum - medianRecentTrade) / medianRecentTrade > LAST_TRADE_OUTLIER_GUARD_PCT;

  const openOrders = useMarket
    ? await db.query<{ bid: string; ask: string }>(
        `SELECT
          (SELECT MAX(price)::text FROM spot_orders WHERE market = $1 AND side = 'buy' AND status IN ('OPEN', 'PARTIALLY_FILLED')) as bid,
          (SELECT MIN(price)::text FROM spot_orders WHERE market = $1 AND side = 'sell' AND status IN ('OPEN', 'PARTIALLY_FILLED')) as ask`,
        [symbol]
      )
    : await db.query<{ bid: string; ask: string }>(
        `SELECT
          (SELECT MAX(o.price)::text FROM spot_orders o JOIN trading_pairs tp ON o.trading_pair_id = tp.id WHERE tp.symbol = $1 AND o.side::text = 'buy' AND o.status::text IN ('new','partially_filled')) as bid,
          (SELECT MIN(o.price)::text FROM spot_orders o JOIN trading_pairs tp ON o.trading_pair_id = tp.id WHERE tp.symbol = $1 AND o.side::text = 'sell' AND o.status::text IN ('new','partially_filled')) as ask`,
        [symbol]
      );
  const bid = openOrders.rows[0]?.bid ?? null;
  const ask = openOrders.rows[0]?.ask ?? null;
  const sanitizedBook = sanitizeTopOfBook(symbol, bid, ask);

  const stats24h = useMarket
    ? await db.query<{
        quote_volume: string;
        base_volume: string;
        high: string;
        low: string;
        open_24h: string | null;
      }>(
        `SELECT
          (SELECT COALESCE(SUM(quantity * price), 0)::text FROM spot_trades WHERE market = $1 AND created_at >= NOW() - INTERVAL '24 hours') as quote_volume,
          (SELECT COALESCE(SUM(quantity), 0)::text FROM spot_trades WHERE market = $1 AND created_at >= NOW() - INTERVAL '24 hours') as base_volume,
          (SELECT COALESCE(MAX(price), 0)::text FROM spot_trades WHERE market = $1 AND created_at >= NOW() - INTERVAL '24 hours') as high,
          (SELECT COALESCE(MIN(price), 0)::text FROM spot_trades WHERE market = $1 AND created_at >= NOW() - INTERVAL '24 hours') as low,
          (SELECT price::text FROM spot_trades WHERE market = $1 AND created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at ASC LIMIT 1) as open_24h`,
        [symbol]
      )
    : await db.query<{
        quote_volume: string;
        base_volume: string;
        high: string;
        low: string;
        open_24h: string | null;
      }>(
        `SELECT
          (SELECT COALESCE(SUM(t.quantity * t.price), 0)::text FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 AND t.created_at >= NOW() - INTERVAL '24 hours') as quote_volume,
          (SELECT COALESCE(SUM(t.quantity), 0)::text FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 AND t.created_at >= NOW() - INTERVAL '24 hours') as base_volume,
          (SELECT COALESCE(MAX(t.price), 0)::text FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 AND t.created_at >= NOW() - INTERVAL '24 hours') as high,
          (SELECT COALESCE(MIN(t.price), 0)::text FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 AND t.created_at >= NOW() - INTERVAL '24 hours') as low,
          (SELECT t.price::text FROM spot_trades t JOIN trading_pairs tp ON t.trading_pair_id = tp.id WHERE tp.symbol = $1 AND t.created_at >= NOW() - INTERVAL '24 hours' ORDER BY t.created_at ASC LIMIT 1) as open_24h`,
        [symbol]
      );
  const s = stats24h.rows[0];

  const [marketState, oracleState, candleFb] = await Promise.all([
    fallbackMarketPrice(symbol),
    fallbackOraclePrice(symbol),
    fallbackPrice(symbol),
  ]);

  let tradeCandidate = tradeFresh ? (lr?.price ?? null) : null;
  if (tradeFresh && latestTradeOutlier && medianRecentTrade != null) {
    tradeCandidate = String(medianRecentTrade);
  }
  if (!tradeCandidate) {
    if (
      medianRecentTrade != null &&
      Number.isFinite(medianRecentTrade) &&
      medianRecentTrade > 0 &&
      lastPriceAgeMs != null &&
      lastPriceAgeMs <= STALE_TRADE_FALLBACK_MAX_AGE_MS
    ) {
      tradeCandidate = String(medianRecentTrade);
    } else if (lr?.price && lastPriceAgeMs != null && lastPriceAgeMs <= STALE_TRADE_FALLBACK_MAX_AGE_MS) {
      tradeCandidate = lr.price;
    }
  }

  const candleFresh = candleFb.candleOpenTimeMs != null && Date.now() - candleFb.candleOpenTimeMs <= CANDLE_1M_STALE_CUTOFF_MS;
  const candleCandidate = candleFresh ? (candleFb.price ?? null) : null;

  const resolved = resolveSpotLastPrice({
    symbol,
    oraclePrice: oracleState.price,
    oracleUpdatedAt: oracleState.updatedAt,
    marketLastPrice: marketState.price,
    marketLastUpdatedAt: marketState.updatedAt,
    tradeLastPrice: tradeCandidate,
    tradeLastPriceAt: lr?.created_at ?? null,
    candle1mLastPrice: candleCandidate,
  });
  const lastPrice = resolved.last_price;
  const lastPriceSource = resolved.last_price_source;

  // Keep 24h fields from the same family as last_price when trades are stale.
  // If trade tape is stale, prefer candle-derived stats for consistency.
  let highPrice = tradeFresh && s?.high && s.high !== '0' ? s.high : null;
  let lowPrice = tradeFresh && s?.low && s.low !== '0' ? s.low : null;
  let openPrice = tradeFresh ? (s?.open_24h ?? null) : null;
  let volPrice = tradeFresh ? (s?.quote_volume ?? '0') : '0';
  let baseVol = tradeFresh ? (s?.base_volume ?? '0') : '0';

  if (!highPrice || !openPrice || volPrice === '0' || baseVol === '0') {
    const fb = await fallback24hStats(symbol);
    const candleFresh = fb.candleOpenTimeMs != null && Date.now() - fb.candleOpenTimeMs <= CANDLE_1D_STALE_CUTOFF_MS;
    if (candleFresh) {
      if (!highPrice && fb.high) highPrice = fb.high;
      if (!lowPrice && fb.low) lowPrice = fb.low;
      if (!openPrice && fb.open) openPrice = fb.open;
      if (fb.volume) {
        const base = parseFloat(fb.volume);
        const px = parseFloat(lastPrice ?? '');
        if (Number.isFinite(base) && base > 0) {
          baseVol = fb.volume;
          if (volPrice === '0') {
            volPrice = Number.isFinite(px) && px > 0 ? String(base * px) : fb.volume;
          }
        }
      }
    }
  }

  // Guard against tiny anomalous prints polluting 24h fields (common in QA/local when
  // a single synthetic fill is far from market). If drift is extreme at very low volume,
  // suppress 24h stats rather than serving misleading values.
  const lastNum = Number(lastPrice ?? '');
  const openNum = Number(openPrice ?? '');
  const baseVolNum = Number(baseVol ?? '0');
  if (
    Number.isFinite(lastNum) &&
    lastNum > 0 &&
    Number.isFinite(openNum) &&
    openNum > 0 &&
    Number.isFinite(baseVolNum) &&
    baseVolNum >= 0
  ) {
    const driftPct = Math.abs(lastNum - openNum) / openNum;
    if (driftPct > 0.5 && baseVolNum <= 0.01) {
      openPrice = null;
      highPrice = null;
      lowPrice = null;
      volPrice = '0';
      baseVol = '0';
    }
  }

  return {
    last_price: lastPrice,
    bid: sanitizedBook.bid,
    ask: sanitizedBook.ask,
    high_24h: highPrice,
    low_24h: lowPrice,
    volume_24h: volPrice,
    base_volume_24h: baseVol,
    open_24h: openPrice,
    last_trade_created_at: lr?.created_at ? String(lr.created_at) : null,
    last_price_source: lastPriceSource,
    last_price_age_ms: resolved.last_price_age_ms ?? lastPriceAgeMs,
    last_price_stale: resolved.last_price_stale,
  };
}
