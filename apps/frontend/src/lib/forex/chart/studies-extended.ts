/**
 * Extended studies for the indicator registry (OHLC-only; volume proxies use tick range when no volume).
 */
import { ema, type StudyBar, type StudyPoint, sourceValue } from './studies';

function sorted(bars: StudyBar[]): StudyBar[] {
  return [...bars].sort((a, b) => a.time - b.time);
}

export function smma(bars: StudyBar[], period: number, src: 'close' = 'close'): StudyPoint[] {
  if (period < 1 || bars.length < period) return [];
  const s = sorted(bars);
  let prev = s.slice(0, period).reduce((a, b) => a + sourceValue(b, src), 0) / period;
  const out: StudyPoint[] = [{ time: s[period - 1]!.time, value: prev }];
  for (let i = period; i < s.length; i++) {
    prev = (prev * (period - 1) + sourceValue(s[i]!, src)) / period;
    out.push({ time: s[i]!.time, value: prev });
  }
  return out;
}

/** Standard deviation of close over period (same OHLC authority as Bollinger). */
export function stdDevSeries(bars: StudyBar[], period: number): StudyPoint[] {
  if (period < 2 || bars.length < period) return [];
  const s = sorted(bars);
  const out: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    const slice = s.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b.close, 0) / period;
    const variance = slice.reduce((a, b) => a + (b.close - mean) ** 2, 0) / period;
    out.push({ time: s[i]!.time, value: Math.sqrt(variance) });
  }
  return out;
}

export function momentum(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  const out: StudyPoint[] = [];
  for (let i = period; i < s.length; i++) {
    out.push({ time: s[i]!.time, value: s[i]!.close - s[i - period]!.close });
  }
  return out;
}

export function roc(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  const out: StudyPoint[] = [];
  for (let i = period; i < s.length; i++) {
    const prev = s[i - period]!.close;
    out.push({ time: s[i]!.time, value: prev === 0 ? 0 : ((s[i]!.close - prev) / prev) * 100 });
  }
  return out;
}

export function williamsR(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  const out: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    const w = s.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((b) => b.high));
    const lo = Math.min(...w.map((b) => b.low));
    const close = s[i]!.close;
    const v = hi === lo ? -50 : ((hi - close) / (hi - lo)) * -100;
    out.push({ time: s[i]!.time, value: v });
  }
  return out;
}

export function stochasticSeries(bars: StudyBar[], period: number): { k: StudyPoint[]; d: StudyPoint[] } {
  const k: StudyPoint[] = [];
  const s = sorted(bars);
  for (let i = period - 1; i < s.length; i++) {
    const w = s.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((b) => b.high));
    const lo = Math.min(...w.map((b) => b.low));
    const close = s[i]!.close;
    k.push({ time: s[i]!.time, value: hi === lo ? 50 : ((close - lo) / (hi - lo)) * 100 });
  }
  const dBars: StudyBar[] = k.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }));
  const d = ema(dBars, 3, 'close');
  return { k, d };
}

export function cci(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  const tp = s.map((b) => (b.high + b.low + b.close) / 3);
  const out: StudyPoint[] = [];
  for (let i = period - 1; i < s.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const md = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    const v = md === 0 ? 0 : (tp[i]! - mean) / (0.015 * md);
    out.push({ time: s[i]!.time, value: v });
  }
  return out;
}

/** ADX simplified from +DM/-DM smoothed (Wilder). */
export function adxSeries(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  if (s.length < period + 2) return [];
  const tr: number[] = [];
  const pdm: number[] = [];
  const mdm: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const up = s[i]!.high - s[i - 1]!.high;
    const down = s[i - 1]!.low - s[i]!.low;
    pdm.push(up > down && up > 0 ? up : 0);
    mdm.push(down > up && down > 0 ? down : 0);
    const hl = s[i]!.high - s[i]!.low;
    const hc = Math.abs(s[i]!.high - s[i - 1]!.close);
    const lc = Math.abs(s[i]!.low - s[i - 1]!.close);
    tr.push(Math.max(hl, hc, lc));
  }
  const wilder = (arr: number[], p: number) => {
    let sum = arr.slice(0, p).reduce((a, b) => a + b, 0);
    const out: number[] = [sum];
    for (let i = p; i < arr.length; i++) {
      sum = sum - sum / p + arr[i]!;
      out.push(sum);
    }
    return out;
  };
  const trs = wilder(tr, period);
  const pdms = wilder(pdm, period);
  const mdms = wilder(mdm, period);
  const dx: StudyPoint[] = [];
  for (let i = 0; i < trs.length; i++) {
    const trv = trs[i]!;
    if (trv <= 0) continue;
    const pdi = (100 * pdms[i]!) / trv;
    const mdi = (100 * mdms[i]!) / trv;
    const d = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
    dx.push({ time: s[i + 1]!.time, value: d });
  }
  const dxBars: StudyBar[] = dx.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }));
  return ema(dxBars, period, 'close');
}

export function parabolicSar(bars: StudyBar[], step = 0.02, max = 0.2): StudyPoint[] {
  const s = sorted(bars);
  if (s.length < 2) return [];
  let bull = true;
  let af = step;
  let ep = s[0]!.high;
  let sar = s[0]!.low;
  const out: StudyPoint[] = [{ time: s[0]!.time, value: sar }];
  for (let i = 1; i < s.length; i++) {
    const b = s[i]!;
    sar = sar + af * (ep - sar);
    if (bull) {
      if (b.low < sar) {
        bull = false;
        sar = ep;
        ep = b.low;
        af = step;
      } else {
        if (b.high > ep) {
          ep = b.high;
          af = Math.min(max, af + step);
        }
      }
    } else if (b.high > sar) {
      bull = true;
      sar = ep;
      ep = b.high;
      af = step;
    } else {
      if (b.low < ep) {
        ep = b.low;
        af = Math.min(max, af + step);
      }
    }
    out.push({ time: b.time, value: sar });
  }
  return out;
}

/** OBV proxy: uses close direction only (Forex candles lack authoritative tick volume). */
export function obv(bars: StudyBar[]): StudyPoint[] {
  const s = sorted(bars);
  let v = 0;
  const out: StudyPoint[] = [];
  for (let i = 0; i < s.length; i++) {
    if (i > 0) {
      if (s[i]!.close > s[i - 1]!.close) v += 1;
      else if (s[i]!.close < s[i - 1]!.close) v -= 1;
    }
    out.push({ time: s[i]!.time, value: v });
  }
  return out;
}

export function mfi(bars: StudyBar[], period: number): StudyPoint[] {
  const s = sorted(bars);
  const tp = s.map((b) => (b.high + b.low + b.close) / 3);
  const out: StudyPoint[] = [];
  for (let i = period; i < s.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j]! * (s[j]!.high - s[j]!.low);
      if (tp[j]! > tp[j - 1]!) pos += flow;
      else neg += flow;
    }
    const ratio = neg === 0 ? 100 : pos / neg;
    out.push({ time: s[i]!.time, value: 100 - 100 / (1 + ratio) });
  }
  return out;
}
