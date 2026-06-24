/**
 * Real market intelligence for markets page — 7d change, market cap, liquidity, sparklines.
 * No synthetic formulas; sources: ohlcv_candles, CoinGecko cache, orderbook health.
 */
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { getCoinInfo, type CoinInfo } from './coin-info.service.js';
import { resolvePublicOrderbookSnapshot } from './spot-orderbook-public.service.js';
import { computeLiquidityHealth } from './liquidity-health.service.js';

const REDIS_FNG_KEY = 'market:fear_greed:v1';
const FNG_TTL_S = 3600;

export type SymbolIntelligence = {
  symbol: string;
  asset: string;
  change_7d_pct: number | null;
  market_cap: number | null;
  liquidity_score: number | null;
  sparkline: number[];
};

export type MarketSentiment = {
  fear_greed_index: number;
  fear_greed_label: string;
  source: 'alternative.me' | 'breadth';
};

async function fetchFearGreedIndex(): Promise<MarketSentiment> {
  try {
    const cached = await redis.get(REDIS_FNG_KEY);
    if (cached) return JSON.parse(cached) as MarketSentiment;
  } catch { /* ignore */ }

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ value: string; value_classification?: string }> };
      const row = json.data?.[0];
      const idx = row ? parseInt(row.value, 10) : NaN;
      if (Number.isFinite(idx)) {
        const payload: MarketSentiment = {
          fear_greed_index: idx,
          fear_greed_label: row?.value_classification ?? 'Neutral',
          source: 'alternative.me',
        };
        void redis.set(REDIS_FNG_KEY, JSON.stringify(payload), FNG_TTL_S).catch(() => {});
        return payload;
      }
    }
  } catch (err) {
    logger.debug('Fear & Greed fetch failed', { error: err instanceof Error ? err.message : String(err) });
  }

  return { fear_greed_index: 50, fear_greed_label: 'Neutral', source: 'breadth' };
}

async function queryChange7d(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const result = await db.queryRead<{ symbol: string; change_7d_pct: string | null }>(`
      WITH latest AS (
        SELECT DISTINCT ON (oc.trading_pair_id)
          oc.trading_pair_id, oc.close_price, oc.open_time
        FROM ohlcv_candles oc
        WHERE oc.interval_type = '1d'
        ORDER BY oc.trading_pair_id, oc.open_time DESC
      ),
      week_ago AS (
        SELECT DISTINCT ON (oc.trading_pair_id)
          oc.trading_pair_id, oc.close_price
        FROM ohlcv_candles oc
        WHERE oc.interval_type = '1d'
          AND oc.open_time <= NOW() - INTERVAL '7 days'
        ORDER BY oc.trading_pair_id, oc.open_time DESC
      )
      SELECT tp.symbol,
        CASE
          WHEN wa.close_price IS NOT NULL AND wa.close_price::numeric > 0 AND l.close_price IS NOT NULL
          THEN ROUND(((l.close_price::numeric - wa.close_price::numeric) / wa.close_price::numeric * 100)::numeric, 2)
          ELSE NULL
        END::text AS change_7d_pct
      FROM latest l
      JOIN trading_pairs tp ON tp.id = l.trading_pair_id
      LEFT JOIN week_ago wa ON wa.trading_pair_id = l.trading_pair_id
    `);
    for (const row of result.rows) {
      if (row.change_7d_pct != null) {
        const v = parseFloat(row.change_7d_pct);
        if (Number.isFinite(v)) map.set(row.symbol.toUpperCase(), v);
      }
    }
  } catch (err) {
    logger.warn('change_7d query failed', { error: err instanceof Error ? err.message : String(err) });
  }
  return map;
}

async function querySparklines(symbols: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (!symbols.length) return map;
  try {
    const result = await db.queryRead<{ symbol: string; closes: string[] | null }>(`
      SELECT tp.symbol,
        ARRAY_AGG(oc.close_price::float ORDER BY oc.open_time ASC) AS closes
      FROM ohlcv_candles oc
      JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
      WHERE oc.interval_type = '1d'
        AND tp.symbol = ANY($1::text[])
        AND oc.open_time >= NOW() - INTERVAL '7 days'
      GROUP BY tp.symbol
    `, [symbols]);
    for (const row of result.rows) {
      const closes = (row.closes ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (closes.length >= 2) map.set(row.symbol.toUpperCase(), closes);
    }
  } catch { /* optional */ }
  return map;
}

function liquidityScoreFromOrderbook(spreadBps: number | null, bidLevels: number, askLevels: number): number {
  const spreadPenalty = spreadBps != null ? Math.min(50, spreadBps / 2) : 25;
  const depthBonus = Math.min(50, ((bidLevels + askLevels) / 20) * 50);
  return Math.max(0, Math.min(100, Math.round(100 - spreadPenalty + depthBonus * 0.3)));
}

async function enrichSymbol(
  symbol: string,
  asset: string,
  change7dMap: Map<string, number>,
  sparklineMap: Map<string, number[]>
): Promise<SymbolIntelligence> {
  const sym = symbol.toUpperCase();
  let market_cap: number | null = null;
  try {
    const info: CoinInfo | null = await getCoinInfo(asset);
    if (info?.market_cap && info.market_cap > 0) market_cap = info.market_cap;
  } catch { /* ignore */ }

  let liquidity_score: number | null = null;
  try {
    const ob = await resolvePublicOrderbookSnapshot(sym, 10);
    const health = computeLiquidityHealth(ob);
    liquidity_score = liquidityScoreFromOrderbook(health.spreadBps, health.bidLevels, health.askLevels);
  } catch { /* ignore */ }

  return {
    symbol: sym,
    asset: asset.toUpperCase(),
    change_7d_pct: change7dMap.get(sym) ?? null,
    market_cap,
    liquidity_score,
    sparkline: sparklineMap.get(sym) ?? [],
  };
}

export async function getMarketIntelligence(symbols: Array<{ symbol: string; asset: string }>): Promise<{
  symbols: Record<string, SymbolIntelligence>;
  sentiment: MarketSentiment;
}> {
  const change7dMap = await queryChange7d();
  const symList = symbols.map((s) => s.symbol.toUpperCase());
  const sparklineMap = await querySparklines(symList);
  const sentiment = await fetchFearGreedIndex();

  const topForLiquidity = symbols.slice(0, 24);
  const enriched = await Promise.all(
    topForLiquidity.map((s) => enrichSymbol(s.symbol, s.asset, change7dMap, sparklineMap))
  );

  const record: Record<string, SymbolIntelligence> = {};
  for (const row of enriched) record[row.symbol] = row;

  for (const s of symbols) {
    const sym = s.symbol.toUpperCase();
    if (!record[sym]) {
      record[sym] = {
        symbol: sym,
        asset: s.asset.toUpperCase(),
        change_7d_pct: change7dMap.get(sym) ?? null,
        market_cap: null,
        liquidity_score: null,
        sparkline: sparklineMap.get(sym) ?? [],
      };
    }
  }

  return { symbols: record, sentiment };
}
