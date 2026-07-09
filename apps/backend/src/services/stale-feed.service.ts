/**
 * Stale feed guard. A market is stale only when trade, oracle, and candle feeds are all quiet.
 * Used by /health for observability; admin can set per-symbol circuit for halt.
 */

import { db } from '../lib/database.js';

const STALE_THRESHOLD_SEC = Number(process.env.STALE_MARKET_THRESHOLD_SEC || 180);

export interface StaleMarketInfo {
  market: string;
  lastTradeAt: string;
  ageSeconds: number;
}

export async function getStaleMarkets(): Promise<StaleMarketInfo[]> {
  const hasMarketCol = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='spot_trades' AND column_name='market') AS exists`
  );
  if (!hasMarketCol.rows[0]?.exists) return [];

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_SEC * 1000);
  const r = await db.query<{ market: string; last_at: string | null }>(
    `SELECT m.symbol AS market,
            GREATEST(
              COALESCE(st.last_at, 'epoch'::timestamptz),
              COALESCE(mp.oracle_updated_at, 'epoch'::timestamptz),
              COALESCE(cnd.candle_at, 'epoch'::timestamptz)
            )::text AS last_at
     FROM spot_markets m
     LEFT JOIN (
       SELECT market, MAX(created_at) AS last_at FROM spot_trades GROUP BY market
     ) st ON st.market = m.symbol
     LEFT JOIN LATERAL (
       SELECT mp2.last_updated AS oracle_updated_at
       FROM market_prices mp2
       WHERE mp2.base_currency_id = m.base_currency_id AND mp2.quote_currency_id = m.quote_currency_id
       LIMIT 1
     ) mp ON TRUE
     LEFT JOIN LATERAL (
       SELECT MAX(oc.open_time) AS candle_at
       FROM ohlcv_candles oc
       JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
       WHERE tp.symbol = m.symbol AND oc.interval_type = '1m'
     ) cnd ON TRUE
     WHERE m.status IN ('active', 'maintenance')
       AND GREATEST(
         COALESCE(st.last_at, 'epoch'::timestamptz),
         COALESCE(mp.oracle_updated_at, 'epoch'::timestamptz),
         COALESCE(cnd.candle_at, 'epoch'::timestamptz)
       ) < $1`,
    [cutoff]
  );

  const now = Date.now();
  return r.rows
    .filter((row) => row.last_at && row.last_at !== 'epoch')
    .map((row) => {
      const lastAt = new Date(row.last_at!).getTime();
      return {
        market: row.market,
        lastTradeAt: row.last_at!,
        ageSeconds: Math.round((now - lastAt) / 1000),
      };
    });
}
