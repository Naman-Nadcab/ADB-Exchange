/**
 * Deterministic Forex studies from OHLC. No volume-based studies (candles have no volume).
 */

export type StudyBar = { time: number; open: number; high: number; low: number; close: number };
export type StudyPoint = { time: number; value: number };
export type SourceKind = 'close' | 'hl2' | 'hlc3' | 'ohlc4';

export function sourceValue(b: StudyBar, src: SourceKind): number {
  if (src === 'hl2') return (b.high + b.low) / 2;
  if (src === 'hlc3') return (b.high + b.low + b.close) / 3;
  if (src === 'ohlc4') return (b.open + b.high + b.low + b.close) / 4;
  return b.close;
}

function sorted(bars: StudyBar[]): StudyBar[] {
  return [...bars].sort((a, b) => a.time - b.time);
}

export function sma(bars: StudyBar[], period: number, src: SourceKind = 'close'): StudyPoint[] {
  if (period < 1 || bars.length < period) return [];
  const s = sorted(bars);
  const out: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += sourceValue(s[j]!, src);
    out.push({ time: s[i]!.time, value: sum / period });
  }
  return out;
}

export function ema(bars: StudyBar[], period: number, src: SourceKind = 'close'): StudyPoint[] {
  if (period < 1 || bars.length < period) return [];
  const s = sorted(bars);
  const k = 2 / (period + 1);
  const seed = sma(s.slice(0, period), period, src)[0];
  if (!seed) return [];
  const out: StudyPoint[] = [seed];
  let prev = seed.value;
  for (let i = period; i < s.length; i++) {
    prev = sourceValue(s[i]!, src) * k + prev * (1 - k);
    out.push({ time: s[i]!.time, value: prev });
  }
  return out;
}

export function wma(bars: StudyBar[], period: number, src: SourceKind = 'close'): StudyPoint[] {
  if (period < 1 || bars.length < period) return [];
  const s = sorted(bars);
  const den = (period * (period + 1)) / 2;
  const out: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    let num = 0;
    for (let w = 1; w <= period; w++) num += sourceValue(s[i - period + w]!, src) * w;
    out.push({ time: s[i]!.time, value: num / den });
  }
  return out;
}

/** Hull MA: WMA(2*WMA(n/2) − WMA(n), sqrt(n)) */
export function hma(bars: StudyBar[], period: number, src: SourceKind = 'close'): StudyPoint[] {
  if (period < 2 || bars.length < period) return [];
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtN = Math.max(1, Math.round(Math.sqrt(period)));
  const w1 = wma(bars, half, src);
  const w2 = wma(bars, period, src);
  const map = new Map(w2.map((p) => [p.time, p.value]));
  const raw: StudyBar[] = [];
  for (const p of w1) {
    const other = map.get(p.time);
    if (other == null) continue;
    raw.push({ time: p.time, open: 2 * p.value - other, high: 2 * p.value - other, low: 2 * p.value - other, close: 2 * p.value - other });
  }
  return wma(raw, sqrtN, 'close');
}

export function rsi(bars: StudyBar[], period = 14, src: SourceKind = 'close'): StudyPoint[] {
  const s = sorted(bars);
  if (s.length < period + 1) return [];
  const changes: number[] = [];
  for (let i = 1; i < s.length; i++) changes.push(sourceValue(s[i]!, src) - sourceValue(s[i - 1]!, src));
  let gain = 0;
  let loss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i]!;
    if (c >= 0) gain += c;
    else loss -= c;
  }
  gain /= period;
  loss /= period;
  const out: StudyPoint[] = [];
  const push = (idx: number) => {
    const rs = loss === 0 ? 100 : gain / loss;
    out.push({ time: s[idx]!.time, value: 100 - 100 / (1 + rs) });
  };
  push(period);
  for (let i = period; i < changes.length; i++) {
    const c = changes[i]!;
    gain = (gain * (period - 1) + Math.max(c, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-c, 0)) / period;
    push(i + 1);
  }
  return out;
}

export function macdSeries(
  bars: StudyBar[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: StudyPoint[]; signal: StudyPoint[]; hist: StudyPoint[] } {
  const eFast = ema(bars, fast);
  const eSlow = ema(bars, slow);
  const slowMap = new Map(eSlow.map((p) => [p.time, p.value]));
  const macd: StudyBar[] = [];
  const macdPts: StudyPoint[] = [];
  for (const p of eFast) {
    const sv = slowMap.get(p.time);
    if (sv == null) continue;
    const v = p.value - sv;
    macdPts.push({ time: p.time, value: v });
    macd.push({ time: p.time, open: v, high: v, low: v, close: v });
  }
  const sig = ema(macd, signal, 'close');
  const sigMap = new Map(sig.map((p) => [p.time, p.value]));
  const hist: StudyPoint[] = [];
  for (const p of macdPts) {
    const s = sigMap.get(p.time);
    if (s == null) continue;
    hist.push({ time: p.time, value: p.value - s });
  }
  return { macd: macdPts, signal: sig, hist };
}

export function atrSeries(bars: StudyBar[], period = 14): StudyPoint[] {
  const s = sorted(bars);
  if (s.length < period + 1) return [];
  const trs: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1]!.close;
    const { high, low } = s[i]!;
    trs.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
  }
  const out: StudyPoint[] = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push({ time: s[period]!.time, value: atr });
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]!) / period;
    out.push({ time: s[i + 1]!.time, value: atr });
  }
  return out;
}

export function bollinger(bars: StudyBar[], period = 20, mult = 2): { mid: StudyPoint[]; upper: StudyPoint[]; lower: StudyPoint[] } {
  const mid = sma(bars, period);
  const s = sorted(bars);
  const upper: StudyPoint[] = [];
  const lower: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    const slice = s.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b.close, 0) / period;
    const variance = slice.reduce((a, b) => a + (b.close - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const t = s[i]!.time;
    upper.push({ time: t, value: mean + mult * sd });
    lower.push({ time: t, value: mean - mult * sd });
  }
  return { mid, upper, lower };
}

export function keltner(bars: StudyBar[], period = 20, atrPeriod = 10, mult = 1.5) {
  const mid = ema(bars, period);
  const atr = atrSeries(bars, atrPeriod);
  const atrMap = new Map(atr.map((p) => [p.time, p.value]));
  const upper: StudyPoint[] = [];
  const lower: StudyPoint[] = [];
  for (const p of mid) {
    const a = atrMap.get(p.time);
    if (a == null) continue;
    upper.push({ time: p.time, value: p.value + mult * a });
    lower.push({ time: p.time, value: p.value - mult * a });
  }
  return { mid, upper, lower };
}

export function donchian(bars: StudyBar[], period = 20) {
  const s = sorted(bars);
  if (s.length < period) return { upper: [] as StudyPoint[], lower: [] as StudyPoint[], mid: [] as StudyPoint[] };
  const upper: StudyPoint[] = [];
  const lower: StudyPoint[] = [];
  const mid: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    const w = s.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((b) => b.high));
    const lo = Math.min(...w.map((b) => b.low));
    upper.push({ time: s[i]!.time, value: hi });
    lower.push({ time: s[i]!.time, value: lo });
    mid.push({ time: s[i]!.time, value: (hi + lo) / 2 });
  }
  return { upper, lower, mid };
}

/** Supertrend: ATR-based trailing bands. */
export function supertrend(bars: StudyBar[], period = 10, mult = 3): StudyPoint[] {
  const s = sorted(bars);
  const atr = atrSeries(s, period);
  const atrMap = new Map(atr.map((p) => [p.time, p.value]));
  const out: StudyPoint[] = [];
  let trend = 1;
  let prevUpper = NaN;
  let prevLower = NaN;
  for (const b of s) {
    const a = atrMap.get(b.time);
    if (a == null) continue;
    const hl2 = (b.high + b.low) / 2;
    let upper = hl2 + mult * a;
    let lower = hl2 - mult * a;
    if (Number.isFinite(prevUpper) && b.close <= prevUpper) upper = Math.min(upper, prevUpper);
    if (Number.isFinite(prevLower) && b.close >= prevLower) lower = Math.max(lower, prevLower);
    if (trend === 1 && b.close < lower) trend = -1;
    else if (trend === -1 && b.close > upper) trend = 1;
    out.push({ time: b.time, value: trend === 1 ? lower : upper });
    prevUpper = upper;
    prevLower = lower;
  }
  return out;
}

export function ichimoku(bars: StudyBar[]) {
  const s = sorted(bars);
  const tenkan: StudyPoint[] = [];
  const kijun: StudyPoint[] = [];
  const spanA: StudyPoint[] = [];
  const spanB: StudyPoint[] = [];
  const mid = (period: number, i: number) => {
    const w = s.slice(i - period + 1, i + 1);
    return (Math.max(...w.map((b) => b.high)) + Math.min(...w.map((b) => b.low))) / 2;
  };
  for (let i = 0; i < s.length; i++) {
    if (i >= 8) tenkan.push({ time: s[i]!.time, value: mid(9, i) });
    if (i >= 25) kijun.push({ time: s[i]!.time, value: mid(26, i) });
    if (i >= 25) {
      const t = tenkan.find((p) => p.time === s[i]!.time)?.value;
      const k = kijun.find((p) => p.time === s[i]!.time)?.value;
      if (t != null && k != null) spanA.push({ time: s[i]!.time, value: (t + k) / 2 });
    }
    if (i >= 51) spanB.push({ time: s[i]!.time, value: mid(52, i) });
  }
  return { tenkan, kijun, spanA, spanB };
}

export function nearestStudy(pts: StudyPoint[], time: number): number | null {
  let best: StudyPoint | null = null;
  for (const p of pts) {
    if (p.time <= time) best = p;
    else break;
  }
  return best?.value ?? null;
}
