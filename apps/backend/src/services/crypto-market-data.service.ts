/**
 * One Chainlink multicall on the crypto RPC updates every spot pair that has
 * an on-chain feed. One CoinGecko markets call fills assets without a feed.
 * Prices land in market_prices. Chart OHLC stays the reference series
 * (Binance backfill / real trades). A live tick only moves the close of an
 * existing reference bar. It never inserts a flat candle and never overwrites
 * a bar that already counts an exchange trade.
 */
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { recordRpcOutbound, recordRpc429 } from '../lib/rpc-budget-manager.js';
import { getCurrencyIdBySymbol } from '../lib/currency-resolver.js';
import { invalidateTickersCache } from './cache-invalidation.service.js';
import { invalidateMarketsCache } from './spot-markets-cache.service.js';
import { getTickerSnapshot, hydrateTickerFromDb } from './spot-live-market-state.service.js';
import { broadcastPublicSpotFeeds } from './spot-live-ws-fanout.service.js';
import {
  CANDLE_INTERVALS,
  CHAINLINK_USD_FEEDS,
  COINGECKO_IDS,
  decodeChainlinkRound,
  formatOraclePrice,
  priceInQuote,
  sparklineToPoints,
  type PricePoint,
} from './crypto-market-data.js';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
];
const ROUND_ABI = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];
const HISTORY_TTL_MS = 10 * 60_000;
const CHAINLINK_MAX_AGE_SEC = 3 * 24 * 3600;
const GECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets';

type MarketRow = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  base_currency_id: string | null;
  quote_currency_id: string | null;
  trading_pair_id: string | null;
};

type AssetBook = {
  usd: number;
  points: PricePoint[];
  source: 'chainlink' | 'coingecko';
};

type GeckoCoin = {
  id?: string;
  current_price?: number | null;
  sparkline_in_7d?: { price?: number[] };
};

let geckoCache: { at: number; byId: Map<string, GeckoCoin> } | null = null;

function rpcUrl(): string {
  return config.blockchain.ethereum.rpcUrl?.trim() ?? '';
}

function rpcIsUsable(url: string): boolean {
  if (!url) return false;
  if (url.includes('alchemy.com/v2/demo')) return false;
  if (url.includes('YOUR_ALCHEMY_KEY')) return false;
  return true;
}

export async function readChainlinkUsdPrices(url: string, nowSec = Math.floor(Date.now() / 1000)): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const roundIface = new Interface(ROUND_ABI);
  const callData = roundIface.encodeFunctionData('latestRoundData', []);
  const calls = CHAINLINK_USD_FEEDS.map((feed) => ({
    target: feed.proxy,
    allowFailure: true,
    callData,
  }));
  const provider = new JsonRpcProvider(url, 1, { staticNetwork: true });
  const multicall = new Contract(MULTICALL3, MULTICALL_ABI, provider);
  const aggregate3 = multicall.getFunction('aggregate3');
  await recordRpcOutbound('other');
  let rows: Array<{ success: boolean; returnData: string }>;
  try {
    rows = await aggregate3.staticCall(calls);
  } catch (error) {
    const blob = error instanceof Error ? error.message : String(error);
    if (/429|rate limit|too many requests/i.test(blob)) await recordRpc429();
    throw error;
  }
  CHAINLINK_USD_FEEDS.forEach((feed, i) => {
    const row = rows[i];
    if (!row?.success || !row.returnData || row.returnData === '0x') return;
    const price = decodeChainlinkRound(row.returnData, feed.decimals, nowSec, CHAINLINK_MAX_AGE_SEC);
    if (price != null) out.set(feed.asset, price);
  });
  return out;
}

async function readCoinGecko(nowMs: number): Promise<Map<string, GeckoCoin>> {
  if (geckoCache && nowMs - geckoCache.at < HISTORY_TTL_MS) return geckoCache.byId;
  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
  const url = `${GECKO_URL}?vs_currency=usd&ids=${encodeURIComponent(ids)}&sparkline=true&price_change_percentage=24h`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const body = (await res.json()) as GeckoCoin[];
    const byId = new Map<string, GeckoCoin>();
    if (Array.isArray(body)) {
      for (const coin of body) {
        if (coin?.id) byId.set(coin.id, coin);
      }
    }
    geckoCache = { at: nowMs, byId };
    return byId;
  } finally {
    clearTimeout(timer);
  }
}

function buildAssetBooks(chainlink: Map<string, number>, gecko: Map<string, GeckoCoin> | null, nowMs: number): Map<string, AssetBook> {
  const books = new Map<string, AssetBook>();
  if (gecko) {
    for (const [asset, id] of Object.entries(COINGECKO_IDS)) {
      const coin = gecko.get(id);
      if (!coin) continue;
      const px = coin.current_price;
      if (px == null || !Number.isFinite(px) || px <= 0) continue;
      const spark = coin.sparkline_in_7d?.price ?? [];
      const points = sparklineToPoints(spark, nowMs);
      if (!points.length || points[points.length - 1]!.p !== px) {
        points.push({ t: Math.floor(nowMs / 1000), p: px });
      } else {
        points[points.length - 1] = { t: Math.floor(nowMs / 1000), p: px };
      }
      books.set(asset, { usd: px, points, source: 'coingecko' });
    }
  }
  for (const [asset, usd] of chainlink) {
    const prev = books.get(asset);
    const points = prev?.points?.length ? prev.points.map((pt) => ({ ...pt })) : [{ t: Math.floor(nowMs / 1000), p: usd }];
    points[points.length - 1] = { t: Math.floor(nowMs / 1000), p: usd };
    books.set(asset, { usd, points, source: 'chainlink' });
  }
  return books;
}

async function loadMarkets(): Promise<MarketRow[]> {
  const result = await db.query<MarketRow>(
    `SELECT sm.symbol, sm.base_asset, sm.quote_asset, sm.base_currency_id, sm.quote_currency_id, tp.id AS trading_pair_id
     FROM spot_markets sm
     LEFT JOIN trading_pairs tp ON tp.symbol = sm.symbol AND tp.trading_enabled = TRUE
     WHERE sm.status IN ('active', 'maintenance')`
  );
  return result.rows;
}

async function upsertPrices(
  rows: Array<{ baseId: string; quoteId: string; price: string }>
): Promise<void> {
  if (!rows.length) return;
  const values: string[] = [];
  const params: string[] = [];
  rows.forEach((row, i) => {
    const n = i * 3;
    values.push(`($${n + 1}, $${n + 2}, $${n + 3}::numeric, NOW())`);
    params.push(row.baseId, row.quoteId, row.price);
  });
  await db.query(
    `INSERT INTO market_prices (base_currency_id, quote_currency_id, price, last_updated)
     VALUES ${values.join(', ')}
     ON CONFLICT (base_currency_id, quote_currency_id)
     DO UPDATE SET price = EXCLUDED.price, last_updated = NOW()`,
    params
  );
}

/** Open the current reference bucket if it is missing, then move its close. Real trade bars stay untouched. */
async function touchFormingClose(rows: Array<{ pairId: string; price: string }>): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const pairIds: string[] = [];
  const intervals: string[] = [];
  const opens: Date[] = [];
  const closes: Date[] = [];
  const prices: string[] = [];
  for (const row of rows) {
    if (!row.pairId || !row.price) continue;
    for (const interval of CANDLE_INTERVALS) {
      const openTimeSec = Math.floor(nowSec / interval.seconds) * interval.seconds;
      pairIds.push(row.pairId);
      intervals.push(interval.intervalType);
      opens.push(new Date(openTimeSec * 1000));
      closes.push(new Date((openTimeSec + interval.seconds) * 1000));
      prices.push(row.price);
    }
  }
  if (!pairIds.length) return;
  const BATCH = 80;
  for (let offset = 0; offset < pairIds.length; offset += BATCH) {
    const end = offset + BATCH;
    await db.query(
      `INSERT INTO ohlcv_candles (
         trading_pair_id, interval_type, open_time, close_time,
         open_price, high_price, low_price, close_price,
         volume, quote_volume, trade_count
       )
       SELECT
         u.pair_id,
         u.interval_type::candle_interval,
         u.open_time,
         u.close_time,
         u.px, u.px, u.px, u.px,
         0, 0, 0
       FROM UNNEST($1::uuid[], $2::text[], $3::timestamptz[], $4::timestamptz[], $5::numeric[])
         AS u(pair_id, interval_type, open_time, close_time, px)
       ON CONFLICT (trading_pair_id, interval_type, open_time) DO UPDATE SET
         high_price = GREATEST(ohlcv_candles.high_price, EXCLUDED.high_price),
         low_price = LEAST(ohlcv_candles.low_price, EXCLUDED.low_price),
         close_price = EXCLUDED.close_price,
         close_time = EXCLUDED.close_time
       WHERE ohlcv_candles.trade_count = 0`,
      [pairIds.slice(offset, end), intervals.slice(offset, end), opens.slice(offset, end), closes.slice(offset, end), prices.slice(offset, end)]
    );
  }
}

function publishTicker(symbol: string, price: string): void {
  const snap = getTickerSnapshot(symbol);
  hydrateTickerFromDb(symbol, {
    last_price: price,
    bid: snap?.bid ?? null,
    ask: snap?.ask ?? null,
    high_24h: snap?.high_24h,
    low_24h: snap?.low_24h,
    open_24h: snap?.open_24h,
    volume_24h: snap?.volume_24h,
    base_volume_24h: snap?.base_volume_24h,
  });
  broadcastPublicSpotFeeds(symbol);
}

export async function refreshCryptoSpotMarketData(): Promise<{ updated: number; errors: string[]; rpcCalls: number }> {
  const errors: string[] = [];
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  let chainlink = new Map<string, number>();
  let rpcCalls = 0;
  const url = rpcUrl();
  if (rpcIsUsable(url)) {
    try {
      chainlink = await readChainlinkUsdPrices(url, nowSec);
      rpcCalls = 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  let gecko: Map<string, GeckoCoin> | null = null;
  try {
    gecko = await readCoinGecko(nowMs);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const books = buildAssetBooks(chainlink, gecko, nowMs);
  if (!books.size) return { updated: 0, errors, rpcCalls };

  const markets = await loadMarkets();
  const usdtUsd = books.get('USDT')?.usd ?? chainlink.get('USDT') ?? 1;
  const btcUsd = books.get('BTC')?.usd ?? chainlink.get('BTC') ?? 0;
  const priceRows: Array<{ baseId: string; quoteId: string; price: string }> = [];
  const writes: Array<{ symbol: string; pairId: string | null; price: string }> = [];

  for (const market of markets) {
    const book = books.get(market.base_asset.toUpperCase());
    if (!book) continue;
    const quoted = priceInQuote(book.usd, market.quote_asset, usdtUsd, btcUsd);
    if (quoted == null) continue;
    const price = formatOraclePrice(quoted);
    if (!price) continue;
    let baseId = market.base_currency_id;
    let quoteId = market.quote_currency_id;
    if (!baseId) baseId = (await getCurrencyIdBySymbol(market.base_asset)) ?? null;
    if (!quoteId) quoteId = (await getCurrencyIdBySymbol(market.quote_asset)) ?? null;
    if (baseId && quoteId) priceRows.push({ baseId, quoteId, price });
    writes.push({ symbol: market.symbol, pairId: market.trading_pair_id, price });
  }

  if (priceRows.length) {
    try {
      await upsertPrices(priceRows);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const candleRows = writes.filter((row): row is typeof row & { pairId: string } => Boolean(row.pairId));
  try {
    await touchFormingClose(candleRows.map((row) => ({ pairId: row.pairId, price: row.price })));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const row of writes) {
    try {
      publishTicker(row.symbol, row.price);
    } catch (error) {
      logger.warn('Crypto spot ticker broadcast failed', {
        symbol: row.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await invalidateTickersCache().catch(() => {});
  await invalidateMarketsCache().catch(() => {});
  try {
    await redis.del('spot:tickers:v3');
  } catch {
    /* best-effort */
  }

  logger.info('Crypto spot market data refreshed', {
    markets: writes.length,
    chainlink: chainlink.size,
    rpcCalls,
  });
  return { updated: writes.length, errors, rpcCalls };
}
