/**
 * Local analysis indicators. Never used for execution, margin, risk, or ledger.
 */
export type Ohlc = { timestamp: string; open: string; high: string; low: string; close: string };

function closes(rows: Ohlc[]): number[] {
  return rows.map((r) => Number(r.close)).filter((n) => Number.isFinite(n));
}

export function sma(values: number[], period: number): Array<number | null> {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    const slice = values.slice(i + 1 - period, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function ema(values: number[], period: number): Array<number | null> {
  const k = 2 / (period + 1);
  const out: Array<number | null> = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!;
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out.push(prev);
      continue;
    }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const d = values[i]! - values[i - 1]!;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values: number[]): { macd: Array<number | null>; signal: Array<number | null> } {
  const e12 = ema(values, 12);
  const e26 = ema(values, 26);
  const line = values.map((_, i) => (e12[i] == null || e26[i] == null ? null : e12[i]! - e26[i]!));
  const compact = line.map((v) => v ?? 0);
  const sigRaw = ema(compact, 9);
  const signal = line.map((v, i) => (v == null ? null : sigRaw[i]));
  return { macd: line, signal };
}

export function bollinger(values: number[], period = 20, k = 2): Array<{ mid: number; upper: number; lower: number } | null> {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    const slice = values.slice(i + 1 - period, i + 1);
    const mid = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    return { mid, upper: mid + k * sd, lower: mid - k * sd };
  });
}

export function atr(rows: Ohlc[], period = 14): Array<number | null> {
  const tr: number[] = rows.map((r, i) => {
    const high = Number(r.high);
    const low = Number(r.low);
    const prev = i === 0 ? Number(r.close) : Number(rows[i - 1]!.close);
    return Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev));
  });
  return sma(tr, period);
}

export function stochastic(rows: Ohlc[], period = 14): Array<number | null> {
  return rows.map((_, i) => {
    if (i + 1 < period) return null;
    const slice = rows.slice(i + 1 - period, i + 1);
    const high = Math.max(...slice.map((r) => Number(r.high)));
    const low = Math.min(...slice.map((r) => Number(r.low)));
    const close = Number(rows[i]!.close);
    if (high === low) return 50;
    return ((close - low) / (high - low)) * 100;
  });
}

export function latestIndicators(rows: Ohlc[]) {
  const c = closes(rows);
  const last = <T>(arr: T[]) => arr[arr.length - 1] ?? null;
  const mac = macd(c);
  return {
    sma20: last(sma(c, 20)),
    ema20: last(ema(c, 20)),
    rsi14: last(rsi(c, 14)),
    macd: last(mac.macd),
    macdSignal: last(mac.signal),
    bollinger: last(bollinger(c, 20)),
    atr14: last(atr(rows, 14)),
    stoch14: last(stochastic(rows, 14)),
  };
}
