/**
 * Tick → candle engine for a single symbol/timeframe.
 * Applies only when historical OHLC and live ticks share the same price source.
 * Do not merge Yahoo historical bars with simulated quote ticks.
 */
import { candleTimeMs, decCmp, type ForexCandle } from '../models/candles';

export const FOREX_CANDLE_PRICE_BASIS = 'mid' as const;

export type ForexTickInput = {
  symbol: string;
  timestamp: string;
  bid?: string | null;
  ask?: string | null;
  mid?: string | null;
};

export type ApplyTickResult =
  | { action: 'ignored'; reason: string; candles: ForexCandle[] }
  | { action: 'update-current'; candles: ForexCandle[] }
  | { action: 'new-candle'; candles: ForexCandle[] };

const TF_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1D': 86_400_000,
  '1W': 604_800_000,
};

export function timeframeBucketMs(timeframe: string): number | null {
  return TF_MS[timeframe] ?? null;
}

export function bucketStartMs(tsMs: number, timeframe: string): number | null {
  const size = timeframeBucketMs(timeframe);
  if (!size || !Number.isFinite(tsMs) || tsMs <= 0) return null;
  return Math.floor(tsMs / size) * size;
}

export function tickPrice(tick: ForexTickInput): string | null {
  if (tick.mid && Number.isFinite(Number(tick.mid)) && Number(tick.mid) > 0) return tick.mid;
  const bid = Number(tick.bid);
  const ask = Number(tick.ask);
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
    return ((bid + ask) / 2).toFixed(8).replace(/\.?0+$/, '');
  }
  if (Number.isFinite(bid) && bid > 0) return String(tick.bid);
  if (Number.isFinite(ask) && ask > 0) return String(tick.ask);
  return null;
}

export function sameCandleSource(historySource: string | undefined, tickSource: string | undefined): boolean {
  if (!historySource || !tickSource) return false;
  const a = historySource.toUpperCase();
  const b = tickSource.toUpperCase();
  if (a.includes('YAHOO') || a.includes('EXTERNAL')) return false;
  return a === b || (a.includes('SIMULATED') && b.includes('SIMULATED'));
}

export function applyTickToCandles(args: {
  candles: ForexCandle[];
  timeframe: string;
  tick: ForexTickInput;
  nowMs?: number;
}): ApplyTickResult {
  const candles = args.candles.slice();
  const price = tickPrice(args.tick);
  if (!price) return { action: 'ignored', reason: 'invalid-price', candles };
  const tickMs = candleTimeMs(args.tick.timestamp);
  if (tickMs == null) return { action: 'ignored', reason: 'invalid-timestamp', candles };
  const now = args.nowMs ?? Date.now();
  if (tickMs > now + 60_000) return { action: 'ignored', reason: 'future-timestamp', candles };
  const bucket = bucketStartMs(tickMs, args.timeframe);
  if (bucket == null) return { action: 'ignored', reason: 'unsupported-timeframe', candles };

  if (candles.length === 0) {
    return {
      action: 'new-candle',
      candles: [{ timestamp: new Date(bucket).toISOString(), open: price, high: price, low: price, close: price }],
    };
  }

  const last = candles[candles.length - 1];
  const lastMs = candleTimeMs(last.timestamp);
  if (lastMs == null) return { action: 'ignored', reason: 'invalid-last-candle', candles };
  const lastBucket = bucketStartMs(lastMs, args.timeframe);
  if (lastBucket == null) return { action: 'ignored', reason: 'invalid-last-bucket', candles };
  if (bucket < lastBucket) return { action: 'ignored', reason: 'out-of-order', candles };

  if (bucket === lastBucket) {
    const high = decCmp(price, last.high) > 0 ? price : last.high;
    const low = decCmp(price, last.low) < 0 ? price : last.low;
    candles[candles.length - 1] = { ...last, high, low, close: price };
    return { action: 'update-current', candles };
  }

  candles.push({ timestamp: new Date(bucket).toISOString(), open: price, high: price, low: price, close: price });
  return { action: 'new-candle', candles };
}
