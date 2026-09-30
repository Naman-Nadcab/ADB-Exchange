/**
 * MOCK simulated market authority for the customer chart live bar.
 *
 * Historical OHLC may come from EXTERNAL Yahoo; the forming / current bucket
 * is derived from the executable SIMULATED quote book (same as order ticket).
 */
import { Decimal } from '../../../lib/decimal.js';
import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexCandleRecord } from './candles.service.js';
import type { ExternalOhlcBar } from './ohlc-yahoo.js';
import { monthStartUtcMs, weekStartUtcMs } from './ohlc-yahoo.js';
import { resolveForexCandleTimeframePlan } from './candle-timeframe-plans.js';

export type ForexMarketDataAuthorityMeta = {
  authority: 'SIMULATED';
  mode: 'MOCK';
  executableSource: 'SIMULATED';
  referenceSource: 'EXTERNAL';
  referenceProvider: 'yahoo';
  historicalBarSource: 'EXTERNAL';
  liveBarSource: 'SIMULATED';
  liveBarReason: 'SIMULATED_MOCK_QUOTE';
};

export const FOREX_MOCK_AUTHORITY_META: ForexMarketDataAuthorityMeta = {
  authority: 'SIMULATED',
  mode: 'MOCK',
  executableSource: 'SIMULATED',
  referenceSource: 'EXTERNAL',
  referenceProvider: 'yahoo',
  historicalBarSource: 'EXTERNAL',
  liveBarSource: 'SIMULATED',
  liveBarReason: 'SIMULATED_MOCK_QUOTE',
};

function timeframeBucketMs(timeframe: string): number | null {
  const plan = resolveForexCandleTimeframePlan(timeframe);
  if (!plan) return null;
  if (plan.kind === 'yahoo') {
    const size: Record<string, number> = {
      '1m': 60_000,
      '5m': 300_000,
      '15m': 900_000,
      '1h': 3_600_000,
      '1D': 24 * 3_600_000,
    };
    return size[plan.timeframe] ?? null;
  }
  return plan.bucketMs;
}

function bucketStartMs(nowMs: number, timeframe: string): number | null {
  const plan = resolveForexCandleTimeframePlan(timeframe);
  if (!plan) return null;
  if (plan.kind === 'aggregate' && plan.bucketFn === 'week') return weekStartUtcMs(nowMs);
  if (plan.kind === 'aggregate' && plan.bucketFn === 'month') return monthStartUtcMs(nowMs);
  const bucketMs = timeframeBucketMs(timeframe);
  if (!bucketMs) return null;
  return Math.floor(nowMs / bucketMs) * bucketMs;
}

function barStartMs(bar: Pick<ForexCandleRecord, 'timestamp'>): number | null {
  const ms = Date.parse(bar.timestamp);
  return Number.isFinite(ms) ? ms : null;
}

function formatPrice(symbol: string, value: string): string {
  const inst = getForexInstrumentBySymbol(symbol);
  const precision = inst?.pricePrecision ?? 5;
  return fxToPriceString(fxDecimal(value), precision);
}

/**
 * Build the current timeframe bucket OHLC from the executable quote.
 * Open = previous settled close when available; otherwise prior bar open.
 */
export function buildSimulatedLiveBar(args: {
  symbol: string;
  timeframe: string;
  quote: ForexQuoteDto;
  historicalBars: ExternalOhlcBar[];
  nowMs?: number;
}): ForexCandleRecord | null {
  const bucketMs = timeframeBucketMs(args.timeframe);
  const nowMs = args.nowMs ?? (Date.parse(args.quote.providerTimestamp) || Date.now());
  const startMs = bucketStartMs(nowMs, args.timeframe);
  if (!bucketMs || startMs == null) return null;

  const bid = fxDecimal(args.quote.bid);
  const ask = fxDecimal(args.quote.ask);
  if (!bid.isFinite() || !ask.isFinite() || !bid.gt(0) || !ask.gt(0) || ask.lt(bid)) return null;

  const mid = bid.plus(ask).div(2);
  const completed = args.historicalBars.filter((b) => {
    const ms = barStartMs(b);
    return ms != null && ms < startMs;
  });
  const inBucketYahoo = args.historicalBars.filter((b) => barStartMs(b) === startMs);

  let open = mid;
  if (inBucketYahoo.length > 0) {
    open = fxDecimal(inBucketYahoo[0]!.open);
  } else if (completed.length > 0) {
    open = fxDecimal(completed[completed.length - 1]!.close);
  }

  const high = Decimal.max(open, bid, ask, mid);
  const low = Decimal.min(open, bid, ask, mid);
  const close = mid;

  return {
    timestamp: new Date(startMs).toISOString(),
    open: formatPrice(args.symbol, open.toString()),
    high: formatPrice(args.symbol, high.toString()),
    low: formatPrice(args.symbol, low.toString()),
    close: formatPrice(args.symbol, close.toString()),
  };
}

/**
 * Replace EXTERNAL forming bucket with SIMULATED live bar; keep older bars as reference history.
 */
export function mergeMockAuthorityLiveBar(args: {
  symbol: string;
  timeframe: string;
  referenceBars: ExternalOhlcBar[];
  quote: ForexQuoteDto | undefined;
  nowMs?: number;
}): { candles: ForexCandleRecord[]; meta: ForexMarketDataAuthorityMeta | null; merged: boolean } {
  if (!args.quote || args.referenceBars.length === 0) {
    return {
      candles: args.referenceBars,
      meta: null,
      merged: false,
    };
  }

  const bucketMs = timeframeBucketMs(args.timeframe);
  const nowMs = args.nowMs ?? (Date.parse(args.quote.providerTimestamp) || Date.now());
  const startMs = bucketStartMs(nowMs, args.timeframe);
  if (!bucketMs || startMs == null) {
    return { candles: args.referenceBars, meta: null, merged: false };
  }

  const live = buildSimulatedLiveBar({
    symbol: args.symbol,
    timeframe: args.timeframe,
    quote: args.quote,
    historicalBars: args.referenceBars,
    nowMs,
  });
  if (!live) {
    return { candles: args.referenceBars, meta: null, merged: false };
  }

  const settled = args.referenceBars.filter((b) => {
    const ms = barStartMs(b);
    return ms != null && ms < startMs;
  });

  return {
    candles: [...settled, live],
    meta: FOREX_MOCK_AUTHORITY_META,
    merged: true,
  };
}
