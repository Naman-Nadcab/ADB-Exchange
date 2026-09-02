/** Local Forex studies from valid OHLC. No external API. */

export type FxBar = { time: number; open: number; high: number; low: number; close: number };

export function lastAtr(bars: FxBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const trs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const { high, low } = sorted[i];
    trs.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
  }
  if (trs.length < period) return null;
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function lastMacd(bars: FxBar[]): { macd: number; signal: number; hist: number } | null {
  if (bars.length < 35) return null;
  const closes = [...bars].sort((a, b) => a.time - b.time).map((b) => b.close);
  const ema = (period: number): number[] => {
    const k = 2 / (period + 1);
    const out: number[] = [];
    let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out.push(e);
    for (let i = period; i < closes.length; i++) {
      e = closes[i] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  };
  const ema12 = ema(12);
  const ema26 = ema(26);
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  if (macdLine.length < 9) return null;
  const k = 2 / 10;
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i] * k + signal * (1 - k);
  const macd = macdLine[macdLine.length - 1];
  return { macd, signal, hist: macd - signal };
}

export function lastStochastic(bars: FxBar[], period = 14): { k: number; d: number } | null {
  if (bars.length < period + 3) return null;
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const ks: number[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    const window = sorted.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((b) => b.high));
    const low = Math.min(...window.map((b) => b.low));
    const close = sorted[i].close;
    ks.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }
  if (ks.length < 3) return null;
  const k = ks[ks.length - 1];
  const d = (ks[ks.length - 1] + ks[ks.length - 2] + ks[ks.length - 3]) / 3;
  return { k, d };
}
