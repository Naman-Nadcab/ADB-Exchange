/**
 * Forming candle from the executable quote already in the forex store.
 * No extra HTTP or RPC: Market Watch, the order ticket, and the chart share one quote.
 */

export type LiveBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const BUCKET_SEC: Record<string, number> = {
  '1m': 60,
  '2m': 120,
  '3m': 180,
  '4m': 240,
  '5m': 300,
  '6m': 360,
  '10m': 600,
  '12m': 720,
  '15m': 900,
  '20m': 1200,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '3h': 10800,
  '4h': 14400,
  '6h': 21600,
  '8h': 28800,
  '12h': 43200,
  '1D': 86400,
  '1W': 7 * 86400,
};

export function forexBucketSeconds(timeframe: string): number | null {
  return BUCKET_SEC[timeframe] ?? null;
}

function num(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fold the current bid/ask into the timeframe bucket.
 * `previous` is the bar accumulated from earlier quotes in this session so
 * high/low survive across ticks. History only seeds the open of a new bucket.
 */
export function foldExecutableQuote(args: {
  history: Array<{ timestamp: string; open: string; high: string; low: string; close: string }>;
  previous: LiveBar | null;
  bid: number;
  ask: number;
  timeframe: string;
  nowSec: number;
}): LiveBar | null {
  const bucket = forexBucketSeconds(args.timeframe);
  if (!bucket) return null;
  const { bid, ask } = args;
  if (![bid, ask].every((n) => Number.isFinite(n) && n > 0) || ask < bid) return null;
  const mid = (bid + ask) / 2;
  const start = Math.floor(args.nowSec / bucket) * bucket;

  if (args.previous && args.previous.time === start) {
    const prev = args.previous;
    return {
      time: start,
      open: prev.open,
      high: Math.max(prev.high, bid, ask, mid),
      low: Math.min(prev.low, bid, ask, mid),
      close: mid,
    };
  }

  let open = mid;
  if (args.previous && args.previous.time < start) {
    open = args.previous.close;
  } else {
    for (let i = args.history.length - 1; i >= 0; i -= 1) {
      const bar = args.history[i]!;
      const ms = Date.parse(bar.timestamp);
      if (!Number.isFinite(ms)) continue;
      const barStart = Math.floor(ms / 1000 / bucket) * bucket;
      if (barStart === start) {
        const seeded = num(bar.open);
        if (seeded != null) open = seeded;
        break;
      }
      if (barStart < start) {
        const seeded = num(bar.close);
        if (seeded != null) open = seeded;
        break;
      }
    }
  }

  return {
    time: start,
    open,
    high: Math.max(open, bid, ask, mid),
    low: Math.min(open, bid, ask, mid),
    close: mid,
  };
}

export function mergeLiveBar(
  history: Array<{ timestamp: string; open: string; high: string; low: string; close: string }>,
  bar: LiveBar,
  digits: number
): Array<{ timestamp: string; open: string; high: string; low: string; close: string }> {
  const dp = Math.max(0, Math.min(digits, 8));
  const fmt = (n: number) => n.toFixed(dp);
  const startMs = bar.time * 1000;
  const kept = history.filter((c) => {
    const ms = Date.parse(c.timestamp);
    return Number.isFinite(ms) && ms < startMs;
  });
  return [
    ...kept,
    {
      timestamp: new Date(startMs).toISOString(),
      open: fmt(bar.open),
      high: fmt(bar.high),
      low: fmt(bar.low),
      close: fmt(bar.close),
    },
  ];
}
