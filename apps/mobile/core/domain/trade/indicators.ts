import type { Candle } from '@exchange/mobile-types';

export type OverlayStudyId =
  | 'none'
  | 'sma_7'
  | 'sma_9'
  | 'sma_25'
  | 'sma_99'
  | 'ema_12'
  | 'ema_26'
  | 'vwap'
  | 'bb_20';

export type ChartStudiesState = {
  overlay: OverlayStudyId;
  rsi: boolean;
  volumeSma: boolean;
  extStackOpen?: boolean;
  ema7?: boolean;
  ema20?: boolean;
  ema50?: boolean;
  ema200?: boolean;
};

export type ChartViewMode = 'candle' | 'depth';

export type IndicatorPoint = { time: number; value: number };

type CandleNum = { time: number; open: number; high: number; low: number; close: number; volume: number };

function toNum(candles: Candle[]): CandleNum[] {
  return candles.map((c) => ({
    time: c.time,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.volume) || 0,
  }));
}

function utcDayStartSec(ts: number): number {
  const d = new Date(ts * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

function typicalPrice(c: CandleNum): number {
  return (c.high + c.low + c.close) / 3;
}

export function computeSma(candles: Candle[], period: number): IndicatorPoint[] {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  if (period < 1 || sorted.length < period) return [];
  const out: IndicatorPoint[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += sorted[j].close;
    out.push({ time: sorted[i].time, value: s / period });
  }
  return out;
}

export function computeEma(candles: Candle[], period: number): IndicatorPoint[] {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  if (period < 1 || sorted.length < period) return [];
  const k = 2 / (period + 1);
  const out: IndicatorPoint[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += sorted[i].close;
  let ema = sum / period;
  out.push({ time: sorted[period - 1].time, value: ema });
  for (let i = period; i < sorted.length; i++) {
    ema = sorted[i].close * k + ema * (1 - k);
    out.push({ time: sorted[i].time, value: ema });
  }
  return out;
}

export function computeVwapDailyUtc(candles: Candle[]): IndicatorPoint[] {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  const out: IndicatorPoint[] = [];
  let dayStart = -1;
  let cumTpV = 0;
  let cumV = 0;
  for (const c of sorted) {
    const d0 = utcDayStartSec(c.time);
    if (d0 !== dayStart) {
      dayStart = d0;
      cumTpV = 0;
      cumV = 0;
    }
    const tp = typicalPrice(c);
    if (c.volume > 0) {
      cumTpV += tp * c.volume;
      cumV += c.volume;
    }
    out.push({ time: c.time, value: cumV > 0 ? cumTpV / cumV : tp });
  }
  return out;
}

export function computeBollinger(
  candles: Candle[],
  period: number,
  mult: number,
): { mid: IndicatorPoint[]; upper: IndicatorPoint[]; lower: IndicatorPoint[] } {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  const mid: IndicatorPoint[] = [];
  const upper: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += sorted[j].close;
    const m = s / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = sorted[j].close - m;
      sumSq += d * d;
    }
    const sd = Math.sqrt(sumSq / period);
    const t = sorted[i].time;
    mid.push({ time: t, value: m });
    upper.push({ time: t, value: m + mult * sd });
    lower.push({ time: t, value: m - mult * sd });
  }
  return { mid, upper, lower };
}

export function computeVolumeSma(candles: Candle[], period: number): IndicatorPoint[] {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  if (period < 1 || sorted.length < period) return [];
  const out: IndicatorPoint[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += sorted[j].volume;
    out.push({ time: sorted[i].time, value: s / period });
  }
  return out;
}

export function computeRsi(candles: Candle[], period: number): IndicatorPoint[] {
  const sorted = toNum(candles).sort((a, b) => a.time - b.time);
  if (sorted.length < period + 1 || period < 1) return [];
  const out: IndicatorPoint[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = sorted[i].close - sorted[i - 1].close;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;
  const pushRsi = (idx: number) => {
    if (avgLoss === 0) out.push({ time: sorted[idx].time, value: 100 });
    else if (avgGain === 0) out.push({ time: sorted[idx].time, value: 0 });
    else {
      const rs = avgGain / avgLoss;
      out.push({ time: sorted[idx].time, value: 100 - 100 / (1 + rs) });
    }
  };
  pushRsi(period);
  for (let i = period + 1; i < sorted.length; i++) {
    const ch = sorted[i].close - sorted[i - 1].close;
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    pushRsi(i);
  }
  return out;
}

export function resolveOverlayStudy(study: OverlayStudyId, candles: Candle[]) {
  switch (study) {
    case 'sma_7':
      return { kind: 'line' as const, points: computeSma(candles, 7), label: 'SMA 7' };
    case 'sma_9':
      return { kind: 'line' as const, points: computeSma(candles, 9), label: 'SMA 9' };
    case 'sma_25':
      return { kind: 'line' as const, points: computeSma(candles, 25), label: 'SMA 25' };
    case 'sma_99':
      return { kind: 'line' as const, points: computeSma(candles, 99), label: 'SMA 99' };
    case 'ema_12':
      return { kind: 'line' as const, points: computeEma(candles, 12), label: 'EMA 12' };
    case 'ema_26':
      return { kind: 'line' as const, points: computeEma(candles, 26), label: 'EMA 26' };
    case 'vwap':
      return { kind: 'line' as const, points: computeVwapDailyUtc(candles), label: 'VWAP' };
    case 'bb_20':
      return { kind: 'bb' as const, ...computeBollinger(candles, 20, 2), label: 'BB 20' };
    default:
      return null;
  }
}
