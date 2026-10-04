/**
 * Shared DB reads for spot ticker (REST + WS subscribe snapshot).
 * Uses same schema branching as GET /spot/ticker/:symbol (market vs trading_pair_id).
 * Display last prefers a fresh oracle. 24h high/low/open follow that last:
 * exchange prints when the tape is fresh, otherwise the 1m reference window.
 */
import { db } from './database.js';
import { getSpotMarketsHasLastPrice, getSpotTradesUseMarket } from './spot-schema-cache.js';
import { resolveSpotLastPrice, type SpotLastPriceSource } from './spot-ticker-price-resolve.js';

export type Reference24h = { high: string; low: string; open: string };

/** Rolling 1m high/low/open for the markets list. Same window as the per-symbol ticker. */
export async function loadReference24hBySymbol(symbols: string[]): Promise<Map<string, Reference24h>> {
  const unique = [...new Set(symbols.filter((s) => typeof s === 'string' && s.length > 0))];
  const out = new Map<string, Reference24h>();
  if (!unique.length) return out;
  const r = await db.query<{ symbol: string; high: string; low: string; open: string }>(
    `SELECT tp.symbol,
            MAX(oc.high_price)::text AS high,
            MIN(oc.low_price)::text AS low,
            (array_agg(oc.open_price ORDER BY oc.open_time ASC))[1]::text AS open
     FROM ohlcv_candles oc
     JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
     WHERE oc.interval_type = '1m'
       AND oc.open_time >= NOW() - INTERVAL '24 hours'
       AND tp.symbol = ANY($1::text[])
     GROUP BY tp.symbol`,
    [unique]
  );
  for (const row of r.rows) {
    if (!row.symbol) continue;
    out.set(row.symbol, { high: row.high, low: row.low, open: row.open });
  }
  return out;
}

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

function formatTickerStatPrice(value: string | null, refPrice: string | null): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const ref = refPrice != null && refPrice !== '' ? refPrice : value;
  const dot = ref.indexOf('.');
  const dec = dot >= 0 ? Math.min(8, Math.max(2, ref.length - dot - 1)) : 2;
  const raw = n.toFixed(dec);
  return raw.replace(/\.?0+$/, '') || raw;
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
  symbol: string,
  referencePrice: number | null = null
): Promise<{ high: string | null; low: string | null; open: string | null; volume: string | null; candleOpenTimeMs: number | null }> {
  const rolling = await fallback24hFrom1mCandles(symbol, referencePrice);
  if (rolling.open != null) return rolling;

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

async function fallback24hFrom1mCandles(
  symbol: string,
  referencePrice: number | null
): Promise<{ high: string | null; low: string | null; open: string | null; volume: string | null; candleOpenTimeMs: number | null }> {
  const r = await db.query<{ open_price: string; high_price: string; low_price: string; close_price: string; volume: string; open_time: string }>(
    `SELECT oc.open_price::text, oc.high_price::text, oc.low_price::text, oc.close_price::text, oc.volume::text, oc.open_time::text
     FROM ohlcv_candles oc
     JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
     WHERE tp.symbol = $1
       AND oc.interval_type = '1m'
       AND oc.open_time >= NOW() - INTERVAL '24 hours'
     ORDER BY oc.open_time ASC`,
    [symbol]
  );
  if (!r.rows.length) return { high: null, low: null, open: null, volume: null, candleOpenTimeMs: null };

  const closes = r.rows.map((row) => Number(row.close_price)).filter((n) => Number.isFinite(n) && n > 0);
  const ref =
    referencePrice != null && Number.isFinite(referencePrice) && referencePrice > 0
      ? referencePrice
      : closes.length
        ? closes[Math.floor(closes.length / 2)]!
        : null;

  const sane = (n: number) =>
    ref == null || !Number.isFinite(ref) || ref <= 0 || (Math.abs(n - ref) / ref <= 0.25 && n > 0);

  const openRow = r.rows.find((row) => sane(Number(row.open_price))) ?? r.rows[0]!;
  const openTimeMs = Date.parse(String(openRow.open_time));
  let high = -Infinity;
  let low = Infinity;
  let vol = 0;
  for (const row of r.rows) {
    const h = Number(row.high_price);
    const l = Number(row.low_price);
    const v = Number(row.volume);
    if (Number.isFinite(h) && sane(h)) high = Math.max(high, h);
    if (Number.isFinite(l) && sane(l)) low = Math.min(low, l);
    if (Number.isFinite(v) && v > 0 && sane(h) && sane(l)) vol += v;
  }

  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return { high: null, low: null, open: null, volume: null, candleOpenTimeMs: null };
  }

  return {
    high: String(high),
    low: String(low),
    open: openRow.open_price,
    volume: vol > 0 ? String(vol) : null,
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

  // Keep 24h fields aligned with resolved last price — ignore internal trade tape when oracle/candle drives last.
  let highPrice: string | null = null;
  let lowPrice: string | null = null;
  let openPrice: string | null = null;
  let volPrice = '0';
  let baseVol = '0';

  const lastNumForRef = Number(lastPrice ?? '');
  const refFor24h = Number.isFinite(lastNumForRef) && lastNumForRef > 0 ? lastNumForRef : null;

  const applyReference24h = (fb: Awaited<ReturnType<typeof fallback24hStats>>) => {
    const candleFresh = fb.candleOpenTimeMs != null && Date.now() - fb.candleOpenTimeMs <= CANDLE_1D_STALE_CUTOFF_MS;
    if (!candleFresh) return;
    if (fb.high) highPrice = fb.high;
    if (fb.low) lowPrice = fb.low;
    if (fb.open) openPrice = fb.open;
    if (fb.volume) {
      const base = parseFloat(fb.volume);
      const px = parseFloat(lastPrice ?? '');
      if (Number.isFinite(base) && base > 0) {
        baseVol = fb.volume;
        volPrice = Number.isFinite(px) && px > 0 ? String(base * px) : fb.volume;
      }
    }
  };

  const oracleDrivenLast = lastPriceSource === 'oracle' || lastPriceSource === 'candle';
  if (oracleDrivenLast) {
    applyReference24h(await fallback24hStats(symbol, refFor24h));
  } else {
    highPrice = tradeFresh && s?.high && s.high !== '0' ? s.high : null;
    lowPrice = tradeFresh && s?.low && s.low !== '0' ? s.low : null;
    openPrice = tradeFresh ? (s?.open_24h ?? null) : null;
    volPrice = tradeFresh ? (s?.quote_volume ?? '0') : '0';
    baseVol = tradeFresh ? (s?.base_volume ?? '0') : '0';
    if (!highPrice || !openPrice || volPrice === '0' || baseVol === '0') {
      applyReference24h(await fallback24hStats(symbol, refFor24h));
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
    high_24h: formatTickerStatPrice(highPrice, lastPrice),
    low_24h: formatTickerStatPrice(lowPrice, lastPrice),
    volume_24h: volPrice,
    base_volume_24h: baseVol,
    open_24h: formatTickerStatPrice(openPrice, lastPrice),
    last_trade_created_at: lr?.created_at ? String(lr.created_at) : null,
    last_price_source: lastPriceSource,
    last_price_age_ms: resolved.last_price_age_ms ?? lastPriceAgeMs,
    last_price_stale: resolved.last_price_stale,
  };
}
