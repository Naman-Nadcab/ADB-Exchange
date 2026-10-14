/**
 * Candle aggregation from spot_trades into ohlcv_candles.
 * Deterministic, idempotent (upsert by bucket). Safe to run periodically.
 * Uses Redis lock to prevent duplicate runs across multiple instances.
 * Scheduled every 2 min in server.ts when runWorkers is true; disable via DISABLE_CANDLE_AGGREGATION=true.
 *
 * Chart history backfill writes reference OHLC only (volume 0, trade_count 0).
 * Real trade candles are never replaced. Set ALLOW_SYNTHETIC_CANDLES=false to skip it.
 */

import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import {
  CHART_HISTORY_BARS,
  CHART_HISTORY_URL,
  CHART_TAIL_BARS,
  needsChartHistoryBackfill,
  needsChartTailSync,
  referenceKline,
  referenceTailLimit,
  seriesHasReferenceGap,
} from './chart-history.js';

const CANDLE_AGG_LOCK_KEY = 'candle_agg:run';
const CANDLE_AGG_LOCK_TTL_MS = 150_000; // 2.5 min
const CANDLE_AGG_LAST_RUN_KEY = 'candle_agg:last_run_epoch_sec';

const INTERVAL_SECONDS_TO_TYPE: Array<{ seconds: number; intervalType: string }> = [
  { seconds: 60, intervalType: '1m' },
  { seconds: 300, intervalType: '5m' },
  { seconds: 900, intervalType: '15m' },
  { seconds: 1800, intervalType: '30m' },
  { seconds: 3600, intervalType: '1h' },
  { seconds: 14400, intervalType: '4h' },
  { seconds: 86400, intervalType: '1d' },
];

const LOOKBACK_HOURS_MAX = 168;
const LOOKBACK_HOURS_DEFAULT = Math.max(
  1,
  Math.min(LOOKBACK_HOURS_MAX, Number(process.env.CANDLE_AGG_LOOKBACK_HOURS ?? 24))
);

const CHART_HISTORY_LOCK_KEY = 'chart_history:run';
const CHART_HISTORY_LOCK_TTL_MS = 180_000;
const CHART_HISTORY_TIMEOUT_MS = 12_000;
const REFERENCE_CONFLICT = `ON CONFLICT (trading_pair_id, interval_type, open_time) DO UPDATE SET
  open_price = EXCLUDED.open_price,
  high_price = EXCLUDED.high_price,
  low_price = EXCLUDED.low_price,
  close_price = EXCLUDED.close_price,
  close_time = EXCLUDED.close_time
WHERE ohlcv_candles.trade_count = 0`;

/**
 * Aggregate spot_trades into ohlcv_candles for all symbols.
 * Supports both schemas: spot_trades.market (spot_markets) or spot_trades.trading_pair_id (trading_pairs).
 * Runs for last LOOKBACK_HOURS. Idempotent via ON CONFLICT DO UPDATE.
 */
export async function runCandleAggregation(): Promise<{ symbolsProcessed: number; candlesUpserted: number }> {
  const lockValue = await redis.acquireLock(CANDLE_AGG_LOCK_KEY, CANDLE_AGG_LOCK_TTL_MS, 1, 0);
  if (!lockValue) return { symbolsProcessed: 0, candlesUpserted: 0 };

  let symbolsProcessed = 0;
  let candlesUpserted = 0;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    let lookbackHours = LOOKBACK_HOURS_DEFAULT;
    try {
      const lastRunRaw = await redis.get(CANDLE_AGG_LAST_RUN_KEY);
      const lastRunSec = Number(lastRunRaw);
      if (Number.isFinite(lastRunSec) && lastRunSec > 0 && lastRunSec < nowSec) {
        const elapsedHours = (nowSec - lastRunSec) / 3600;
        // Keep a small overlap so late-arriving trades can still update prior buckets.
        const overlapHours = 2;
        lookbackHours = Math.max(1, Math.min(LOOKBACK_HOURS_DEFAULT, Math.ceil(elapsedHours) + overlapHours));
      }
    } catch {
      // Redis read failure should not block aggregation; default lookback will be used.
    }

    const hasMarketCol = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_trades' AND column_name = 'market') AS exists`
    );
    const useMarketColumn = hasMarketCol.rows[0]?.exists === true;

    const hasOhlcv = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ohlcv_candles') AS exists`
    );
    if (!hasOhlcv.rows[0]?.exists) {
      logger.debug('ohlcv_candles table not present; skipping aggregation');
      return { symbolsProcessed: 0, candlesUpserted: 0 };
    }

    type Row = { id: string; symbol: string };
    let rows: Row[] = [];

    if (useMarketColumn) {
      const markets = await db.query<Row>(`SELECT id, symbol FROM spot_markets WHERE status IN ('active', 'maintenance')`);
      for (const m of markets.rows) {
        const tp = await db.query<{ id: string }>(`SELECT id FROM trading_pairs WHERE symbol = $1 AND trading_enabled = TRUE LIMIT 1`, [m.symbol]);
        if (tp.rows.length > 0) rows.push({ id: tp.rows[0]!.id, symbol: m.symbol });
      }
    } else {
      const pairs = await db.query<Row>(`SELECT id, symbol FROM trading_pairs WHERE trading_enabled = TRUE`);
      rows = pairs.rows;
    }

    const filterCol = useMarketColumn ? 'market' : 'trading_pair_id';
    const symbolOrIdKey = useMarketColumn ? 'symbol' : 'id';

    for (const row of rows) {
      const tradingPairId = row.id;
      const symbolOrId = row[symbolOrIdKey as keyof Row];

      for (const { seconds: intervalSeconds, intervalType } of INTERVAL_SECONDS_TO_TYPE) {
        const bucketExpr = `to_timestamp(floor(extract(epoch from created_at) / ${intervalSeconds}) * ${intervalSeconds})`;
        const buckets = await db.query<{
          open_time: Date;
          open_price: string;
          high_price: string;
          low_price: string;
          close_price: string;
          volume: string;
          quote_volume: string;
          trade_count: string;
        }>(
          `SELECT
            ${bucketExpr} AS open_time,
            (array_agg(price ORDER BY created_at ASC))[1]::decimal AS open_price,
            max(price)::decimal AS high_price,
            min(price)::decimal AS low_price,
            (array_agg(price ORDER BY created_at DESC))[1]::decimal AS close_price,
            coalesce(sum(quantity), 0)::decimal AS volume,
            coalesce(sum(price * quantity), 0)::decimal AS quote_volume,
            count(*)::int AS trade_count
          FROM spot_trades
          WHERE ${filterCol} = $1 AND created_at >= NOW() - ($2 * INTERVAL '1 hour')
          GROUP BY ${bucketExpr}`,
          [symbolOrId, lookbackHours]
        );

        for (const b of buckets.rows) {
          const openTime = b.open_time;
          const closeTime = new Date(openTime.getTime() + intervalSeconds * 1000);

          await db.query(
            `INSERT INTO ohlcv_candles (
              trading_pair_id, interval_type, open_time, close_time,
              open_price, high_price, low_price, close_price,
              volume, quote_volume, trade_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (trading_pair_id, interval_type, open_time)
            DO UPDATE SET
              open_price = EXCLUDED.open_price,
              high_price = EXCLUDED.high_price,
              low_price = EXCLUDED.low_price,
              close_price = EXCLUDED.close_price,
              volume = EXCLUDED.volume,
              quote_volume = EXCLUDED.quote_volume,
              trade_count = EXCLUDED.trade_count`,
            [
              tradingPairId,
              intervalType,
              openTime,
              closeTime,
              b.open_price,
              b.high_price,
              b.low_price,
              b.close_price,
              b.volume,
              b.quote_volume,
              b.trade_count,
            ]
          );
          candlesUpserted++;
        }
      }
      symbolsProcessed++;
    }
    await redis.set(CANDLE_AGG_LAST_RUN_KEY, String(nowSec));
  } catch (err) {
    logger.error('Candle aggregation failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    try {
      await redis.releaseLock(CANDLE_AGG_LOCK_KEY, lockValue);
    } catch {
      /* best-effort; lock will expire by TTL */
    }
  }

  return { symbolsProcessed, candlesUpserted };
}

function toOracleSymbol(marketSymbol: string): string {
  return marketSymbol.replace(/_/g, '').replace(/-/g, '');
}

const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

type RefCandle = NonNullable<ReturnType<typeof referenceKline>>;

async function fetchReferenceKlines(
  oracleSym: string,
  binanceInterval: string,
  limit: number
): Promise<{ ok: true; candles: RefCandle[] } | { ok: false; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHART_HISTORY_TIMEOUT_MS);
  try {
    const url = `${CHART_HISTORY_URL}?symbol=${encodeURIComponent(oracleSym)}&interval=${binanceInterval}&limit=${limit}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: res.status === 400 ? undefined : `market data ${res.status}` };
    }
    const klines = (await res.json()) as Array<Array<number | string>>;
    if (!Array.isArray(klines)) return { ok: false };
    const candles = klines.map(referenceKline).filter((k): k is RefCandle => k != null);
    const minBars = limit >= 50 ? 50 : 1;
    if (candles.length < minBars) return { ok: false };
    return { ok: true, candles };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('aborted')) return { ok: false };
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertReferenceCandles(pairId: string, intervalType: string, candles: RefCandle[]): Promise<number> {
  let seeded = 0;
  const BATCH = 80;
  for (let i = 0; i < candles.length; i += BATCH) {
    const chunk = candles.slice(i, i + BATCH);
    const values: string[] = [];
    const params: Array<string | Date> = [];
    chunk.forEach((k, n) => {
      const idx = n * 8;
      values.push(
        `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}::numeric, $${idx + 6}::numeric, $${idx + 7}::numeric, $${idx + 8}::numeric, 0, 0, 0)`
      );
      params.push(pairId, intervalType, k.openTime, k.closeTime, k.open, k.high, k.low, k.close);
    });
    await db.query(
      `INSERT INTO ohlcv_candles (
         trading_pair_id, interval_type, open_time, close_time,
         open_price, high_price, low_price, close_price,
         volume, quote_volume, trade_count
       ) VALUES ${values.join(', ')}
       ${REFERENCE_CONFLICT}`,
      params
    );
    seeded += chunk.length;
  }
  return seeded;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

/**
 * Fill each spot chart interval with reference OHLC when the stored series
 * is short or flat. One public kline request per thin series. Exchange
 * trades (trade_count > 0) and their volume are not replaced.
 */
export async function seedSyntheticCandles(): Promise<{ seeded: number; errors: string[] }> {
  const errors: string[] = [];
  let seeded = 0;
  if (process.env.ALLOW_SYNTHETIC_CANDLES === 'false') {
    logger.info('Chart history backfill skipped (ALLOW_SYNTHETIC_CANDLES=false)');
    return { seeded, errors };
  }

  const lockValue = await redis.acquireLock(CHART_HISTORY_LOCK_KEY, CHART_HISTORY_LOCK_TTL_MS, 1, 0);
  if (!lockValue) return { seeded, errors };

  try {
    const hasOhlcv = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ohlcv_candles') AS exists`
    );
    if (!hasOhlcv.rows[0]?.exists) return { seeded, errors };

    const markets = await db.query<{ id: string; symbol: string }>(
      `SELECT sm.symbol, tp.id
       FROM spot_markets sm
       JOIN trading_pairs tp ON tp.symbol = sm.symbol AND tp.trading_enabled = TRUE
       WHERE sm.status IN ('active', 'maintenance')`
    );

    logger.info('Chart history backfill starting', { markets: markets.rows.length });

    await mapPool(markets.rows, 3, async (m) => {
      const oracleSym = toOracleSymbol(m.symbol);
      for (const { seconds, intervalType } of INTERVAL_SECONDS_TO_TYPE) {
        const binanceInterval = BINANCE_INTERVAL_MAP[intervalType];
        if (!binanceInterval) continue;
        try {
          const windowSec = seconds * CHART_HISTORY_BARS;
          const coverage = await db.query<{ n: number; flat: number; recent_flat: number }>(
            `SELECT count(*)::int AS n,
                    count(*) FILTER (
                      WHERE open_price = high_price AND high_price = low_price AND low_price = close_price
                    )::int AS flat,
                    count(*) FILTER (
                      WHERE open_time >= NOW() - INTERVAL '30 minutes'
                        AND open_time < NOW() - ($4::int * INTERVAL '1 second')
                        AND open_price = high_price AND high_price = low_price AND low_price = close_price
                    )::int AS recent_flat
             FROM ohlcv_candles
             WHERE trading_pair_id = $1 AND interval_type = $2
               AND open_time >= NOW() - ($3::int * INTERVAL '1 second')`,
            [m.id, intervalType, windowSec, seconds * 2]
          );
          const row = coverage.rows[0];
          if (!needsChartHistoryBackfill(row?.n ?? 0, row?.flat ?? 0, CHART_HISTORY_BARS, row?.recent_flat ?? 0)) {
            await db.query(
              `DELETE FROM ohlcv_candles
               WHERE trading_pair_id = $1 AND interval_type = $2 AND trade_count = 0
                 AND open_time < NOW() - ($3::int * INTERVAL '1 second')`,
              [m.id, intervalType, windowSec]
            );
            const newest = await db.query<{ open_time: Date | null }>(
              `SELECT MAX(open_time) AS open_time
               FROM ohlcv_candles
               WHERE trading_pair_id = $1 AND interval_type = $2`,
              [m.id, intervalType]
            );
            const newestMs = newest.rows[0]?.open_time ? new Date(newest.rows[0].open_time).getTime() : null;
            const staleTip = needsChartTailSync(newestMs, seconds);
            const gap = seriesHasReferenceGap(row?.n ?? 0);
            if (!staleTip && !gap) continue;

            const tailLimit = gap ? referenceTailLimit(row?.n ?? 0) : CHART_TAIL_BARS;
            const tail = await fetchReferenceKlines(oracleSym, binanceInterval, tailLimit);
            if (!tail.ok) {
              if (tail.error) errors.push(`${m.symbol}/${intervalType}: ${tail.error}`);
              continue;
            }
            seeded += await upsertReferenceCandles(m.id, intervalType, tail.candles);
            continue;
          }

          const history = await fetchReferenceKlines(oracleSym, binanceInterval, CHART_HISTORY_BARS);
          if (!history.ok) {
            if (history.error) errors.push(`${m.symbol}/${intervalType}: ${history.error}`);
            continue;
          }
          const candles = history.candles;
          seeded += await upsertReferenceCandles(m.id, intervalType, candles);

          const first = candles[0]!.openTime;
          const last = candles[candles.length - 1]!.openTime;
          await db.query(
            `DELETE FROM ohlcv_candles
             WHERE trading_pair_id = $1 AND interval_type = $2 AND trade_count = 0
               AND (open_time < $3 OR open_time > $4)`,
            [m.id, intervalType, first, last]
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('aborted')) errors.push(`${m.symbol}/${intervalType}: ${msg}`);
        }
      }
    });
  } catch (err) {
    logger.error('Chart history backfill failed', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    await redis.releaseLock(CHART_HISTORY_LOCK_KEY, lockValue).catch(() => {});
  }

  return { seeded, errors };
}
