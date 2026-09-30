/**
 * Server-side Yahoo chart adapter for historical Forex OHLC.
 * Non-financial authority. Never used for balance, margin, P&L, or execution.
 * No API key. Fail closed to UNAVAILABLE — never synthesize bars.
 */
import { isValidOhlcRelation } from './ohlc-validate.js';
import { resolveForexCandleTimeframePlan } from './candle-timeframe-plans.js';

export const YAHOO_SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D'] as const;
export type YahooForexTimeframe = (typeof YAHOO_SUPPORTED_TIMEFRAMES)[number];

const YAHOO_INTERVAL: Record<YahooForexTimeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '1D': '1d',
};

const YAHOO_RANGE: Record<YahooForexTimeframe, string> = {
  '1m': '7d',
  '5m': '60d',
  '15m': '60d',
  '1h': '6mo',
  '1D': '2y',
};

/** Spot FX via Yahoo FX pairs. Metals use COMEX futures proxies (documented). */
const YAHOO_SYMBOL: Record<string, { yahoo: string; note?: string }> = {
  EURUSD: { yahoo: 'EURUSD=X' },
  GBPUSD: { yahoo: 'GBPUSD=X' },
  USDJPY: { yahoo: 'USDJPY=X' },
  USDCHF: { yahoo: 'USDCHF=X' },
  AUDUSD: { yahoo: 'AUDUSD=X' },
  USDCAD: { yahoo: 'USDCAD=X' },
  NZDUSD: { yahoo: 'NZDUSD=X' },
  EURGBP: { yahoo: 'EURGBP=X' },
  EURJPY: { yahoo: 'EURJPY=X' },
  GBPJPY: { yahoo: 'GBPJPY=X' },
  XAUUSD: { yahoo: 'GC=F', note: 'COMEX gold futures proxy' },
  XAGUSD: { yahoo: 'SI=F', note: 'COMEX silver futures proxy' },
};

export type ExternalOhlcBar = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

export function yahooSymbolFor(edaSymbol: string): { yahoo: string; note?: string } | null {
  return YAHOO_SYMBOL[edaSymbol] ?? null;
}

export function isYahooTimeframe(value: string): value is YahooForexTimeframe {
  return (YAHOO_SUPPORTED_TIMEFRAMES as readonly string[]).includes(value);
}

const THIRTY_M_MS = 30 * 60 * 1000;
const FOUR_H_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC containing `ms` — used for 1W aggregation from daily bars. */
export function weekStartUtcMs(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday);
}

export function monthStartUtcMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function aggregateToBucketMs(
  bars: ExternalOhlcBar[],
  bucketMs: number,
  bucketFn: 'floor' | 'week' | 'month' = 'floor'
): ExternalOhlcBar[] {
  const fn =
    bucketFn === 'week' ? weekStartUtcMs : bucketFn === 'month' ? monthStartUtcMs : (ms: number) => Math.floor(ms / bucketMs) * bucketMs;
  return aggregateBarsToBucket(bars, bucketMs, fn);
}

/**
 * Roll valid bars into fixed UTC buckets.
 * Open = first open, High = max, Low = min, Close = last close.
 * Never synthesizes empty buckets.
 */
export function aggregateBarsToBucket(
  bars: ExternalOhlcBar[],
  bucketMs: number,
  bucketFn: (ms: number) => number = (ms) => Math.floor(ms / bucketMs) * bucketMs
): ExternalOhlcBar[] {
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) return [];
  const buckets = new Map<number, ExternalOhlcBar[]>();
  for (const bar of bars) {
    const ms = Date.parse(bar.timestamp);
    if (!Number.isFinite(ms)) continue;
    const bucket = bucketFn(ms);
    const list = buckets.get(bucket) ?? [];
    list.push(bar);
    buckets.set(bucket, list);
  }
  const out: ExternalOhlcBar[] = [];
  for (const [bucket, list] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const first = list[0];
    const last = list[list.length - 1];
    if (!first || !last) continue;
    let high = Number(first.high);
    let low = Number(first.low);
    for (const x of list) {
      const h = Number(x.high);
      const l = Number(x.low);
      if (Number.isFinite(h) && h > high) high = h;
      if (Number.isFinite(l) && l < low) low = l;
    }
    const bar: ExternalOhlcBar = {
      timestamp: new Date(bucket).toISOString(),
      open: first.open,
      high: String(high),
      low: String(low),
      close: last.close,
    };
    if (isValidOhlcRelation(bar)) out.push(bar);
  }
  return out;
}

/** Align / dedupe bars onto timeframe boundaries (fixes Yahoo partial last bar seconds). */
export function alignBarsToTimeframe(bars: ExternalOhlcBar[], timeframe: string): ExternalOhlcBar[] {
  const plan = resolveForexCandleTimeframePlan(timeframe);
  if (!plan) return bars;
  if (plan.kind === 'yahoo') {
    const size: Record<string, number> = {
      '1m': 60_000,
      '5m': 300_000,
      '15m': 900_000,
      '1h': 3_600_000,
      '1D': DAY_MS,
    };
    const ms = size[plan.timeframe];
    if (!ms) return bars;
    return aggregateBarsToBucket(bars, ms);
  }
  const bucketFn =
    plan.bucketFn === 'week' ? weekStartUtcMs : plan.bucketFn === 'month' ? monthStartUtcMs : (ms: number) => Math.floor(ms / plan.bucketMs) * plan.bucketMs;
  return aggregateBarsToBucket(bars, plan.bucketMs, bucketFn);
}

/** Roll valid 1h bars into UTC 4h buckets. */
export function aggregateHourlyTo4h(bars: ExternalOhlcBar[]): ExternalOhlcBar[] {
  return aggregateBarsToBucket(bars, FOUR_H_MS);
}

/** Roll valid 15m bars into UTC 30m buckets. */
export function aggregateFifteenTo30m(bars: ExternalOhlcBar[]): ExternalOhlcBar[] {
  return aggregateBarsToBucket(bars, THIRTY_M_MS);
}

/** Roll valid 1D bars into ISO weeks (Monday UTC). */
export function aggregateDailyTo1W(bars: ExternalOhlcBar[]): ExternalOhlcBar[] {
  return aggregateBarsToBucket(bars, 7 * DAY_MS, weekStartUtcMs);
}

function dec(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return String(n);
}

export function parseYahooChart(payload: unknown): ExternalOhlcBar[] {
  if (!payload || typeof payload !== 'object') return [];
  const chart = (payload as { chart?: { result?: unknown[] } }).chart;
  const result = Array.isArray(chart?.result) ? chart.result[0] : null;
  if (!result || typeof result !== 'object') return [];
  const rec = result as {
    timestamp?: unknown;
    indicators?: { quote?: Array<{ open?: unknown; high?: unknown; low?: unknown; close?: unknown }> };
  };
  const ts = Array.isArray(rec.timestamp) ? rec.timestamp : [];
  const quote = rec.indicators?.quote?.[0];
  if (!quote) return [];
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const out: ExternalOhlcBar[] = [];
  for (let i = 0; i < ts.length; i += 1) {
    const rawTs = ts[i];
    const sec = typeof rawTs === 'number' ? rawTs : Number(rawTs);
    if (!Number.isFinite(sec) || sec <= 0) continue;
    const open = dec(opens[i]);
    const high = dec(highs[i]);
    const low = dec(lows[i]);
    const close = dec(closes[i]);
    if (!open || !high || !low || !close) continue;
    const bar = { timestamp: new Date(sec * 1000).toISOString(), open, high, low, close };
    if (!isValidOhlcRelation(bar)) continue;
    out.push(bar);
  }
  out.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return out;
}

export async function fetchYahooOhlc(args: {
  symbol: string;
  timeframe: YahooForexTimeframe;
  limit: number;
  from?: string;
  to?: string;
}): Promise<{ bars: ExternalOhlcBar[]; providerSymbol: string; note?: string }> {
  const mapped = yahooSymbolFor(args.symbol);
  if (!mapped) {
    throw new Error('YAHOO_SYMBOL_UNMAPPED');
  }
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahoo)}`);
  url.searchParams.set('interval', YAHOO_INTERVAL[args.timeframe]);
  url.searchParams.set('range', YAHOO_RANGE[args.timeframe]);
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('events', 'div');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'EDA-Forex-OHLC/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`YAHOO_HTTP_${res.status}`);
  }
  const json = (await res.json()) as unknown;
  let bars = parseYahooChart(json);
  if (args.from) {
    const fromMs = Date.parse(args.from);
    bars = bars.filter((b) => Date.parse(b.timestamp) >= fromMs);
  }
  if (args.to) {
    const toMs = Date.parse(args.to);
    bars = bars.filter((b) => Date.parse(b.timestamp) <= toMs);
  }
  if (bars.length > args.limit) {
    bars = bars.slice(bars.length - args.limit);
  }
  return { bars, providerSymbol: mapped.yahoo, note: mapped.note };
}
