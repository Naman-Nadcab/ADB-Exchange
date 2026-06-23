/**
 * Lightweight Charts enforces ascending, unique timestamps for setData/setMarkers/update.
 * Backend + live merges can violate that; sanitize at every boundary so the UI never hard-crashes.
 */

import type { UTCTimestamp } from 'lightweight-charts';
import type { CandleData, TradeMarker } from './ChartAdapter';

export function floorUtcTimeSeconds(t: unknown): number | null {
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Sort by time ascending, floor seconds, dedupe equal times (keep last row).
 */
export function sanitizeKeyedByTime<T extends { time: number }>(items: readonly T[]): T[] {
  const staged = items
    .map((row) => {
      const ft = floorUtcTimeSeconds(row.time);
      if (ft == null) return null;
      return { ...row, time: ft } as T;
    })
    .filter((x): x is T => x != null);

  staged.sort((a, b) => a.time - b.time);

  const out: T[] = [];
  for (const row of staged) {
    const prev = out[out.length - 1];
    if (prev && prev.time === row.time) out[out.length - 1] = row;
    else out.push(row);
  }
  return out;
}

export function sanitizeCandles(data: CandleData[]): CandleData[] {
  const normalized: CandleData[] = data
    .map((c): CandleData | null => {
      const time = floorUtcTimeSeconds(c.time);
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      const rawVolume = c.volume == null ? 0 : Number(c.volume);
      if (time == null) return null;
      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return null;
      if (!Number.isFinite(rawVolume)) return null;
      const top = Math.max(high, open, close);
      const bottom = Math.min(low, open, close);
      return {
        time,
        open,
        high: top,
        low: bottom,
        close,
        volume: rawVolume >= 0 ? rawVolume : 0,
      };
    })
    .filter((row): row is CandleData => row != null);
  return sanitizeKeyedByTime(normalized);
}

export function lineSeriesDataFromRows(rows: readonly { time: number; value: number }[]): {
  time: UTCTimestamp;
  value: number;
}[] {
  return sanitizeKeyedByTime(rows.map((r) => ({ time: r.time, value: r.value }))).map((r) => ({
    time: r.time as UTCTimestamp,
    value: r.value,
  }));
}

export function histogramSeriesDataFromCandles(candles: CandleData[], volColor: (up: boolean) => string): {
  time: UTCTimestamp;
  value: number;
  color: string;
}[] {
  const normalized = sanitizeCandles(candles);
  const maxVolume = normalized.reduce((mx, c) => Math.max(mx, Number(c.volume ?? 0)), 0);
  return normalized.map((c) => {
    const base = volColor(c.close >= c.open);
    const vol = Number(c.volume ?? 0);
    const intensity = maxVolume > 0 ? Math.min(1, Math.max(0.2, vol / maxVolume)) : 0.45;
    const alpha = 0.22 + intensity * 0.55;
    const color = base.replace(/rgba\(([^)]+),\s*[\d.]+\)/, 'rgba($1, ' + alpha.toFixed(3) + ')');
    return {
      time: c.time as UTCTimestamp,
      value: vol,
      color: color === base ? base : color,
    };
  });
}

export function candlestickDataFromSanitized(candles: CandleData[]): {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}[] {
  return sanitizeCandles(candles).map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function sanitizeTradeMarkers(trades: readonly TradeMarker[]): TradeMarker[] {
  return sanitizeTradeMarkersForChart(trades).markers;
}

export type MarkerSanitizationDiagnostics = {
  markers: TradeMarker[];
  invalidCount: number;
  duplicateCount: number;
  symbol: string;
};

export function sanitizeTradeMarkersForChart(trades: readonly TradeMarker[]): MarkerSanitizationDiagnostics {
  // Lightweight Charts setMarkers() requires strict ascending time order.
  // Keep only one marker per second and drop invalid/non-monotonic residue.
  let invalidCount = 0;
  const readSymbol = (row: unknown): string | null => {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    const raw = rec.symbol ?? rec.market;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };
  const symbol = trades.map((t) => readSymbol(t)).find((s): s is string => Boolean(s)) ?? 'unknown';

  const sorted = sanitizeKeyedByTime(
    trades
      .map((t) => {
        if (t == null || typeof t !== 'object') {
          invalidCount += 1;
          return null;
        }
        const rec = t as unknown as Record<string, unknown>;
        const rawTime = rec.time;
        if (rawTime == null || rawTime === '') {
          invalidCount += 1;
          return null;
        }
        const time = floorUtcTimeSeconds(rawTime);
        const price = Number(rec.price);
        const side = rec.side === 'sell' ? 'sell' : rec.side === 'buy' ? 'buy' : null;
        if (time == null || !Number.isFinite(price) || price <= 0 || side == null) {
          invalidCount += 1;
          return null;
        }
        return { time, price, side } satisfies TradeMarker;
      })
      .filter((row): row is TradeMarker => row != null)
  );
  const out: TradeMarker[] = [];
  let duplicateCount = 0;
  let prevTime = -1;
  for (const row of sorted) {
    if (!Number.isFinite(row.time)) continue;
    if (row.time <= prevTime) {
      duplicateCount += 1;
      continue;
    }
    out.push(row);
    prevTime = row.time;
  }
  return { markers: out, invalidCount, duplicateCount, symbol };
}
