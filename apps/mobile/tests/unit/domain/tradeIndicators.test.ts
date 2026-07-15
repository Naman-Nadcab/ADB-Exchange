import { describe, it, expect } from '@jest/globals';
import { computeSma, computeRsi, computeBollinger } from '@core/domain/trade/indicators';
import { buildDepthSeries } from '@core/domain/trade/depthChart';
import type { Candle } from '@exchange/mobile-types';

const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
  time: 1_700_000_000 + i * 300,
  open: String(100 + i),
  high: String(101 + i),
  low: String(99 + i),
  close: String(100 + i),
  volume: String(10 + i),
}));

describe('trade indicators', () => {
  it('computes SMA', () => {
    const sma = computeSma(candles, 7);
    expect(sma.length).toBe(24);
    expect(sma[0].value).toBeGreaterThan(0);
  });

  it('computes RSI', () => {
    const rsi = computeRsi(candles, 14);
    expect(rsi.length).toBeGreaterThan(0);
    expect(rsi[0].value).toBeGreaterThanOrEqual(0);
    expect(rsi[0].value).toBeLessThanOrEqual(100);
  });

  it('computes Bollinger bands', () => {
    const bb = computeBollinger(candles, 20, 2);
    expect(bb.mid.length).toBe(11);
    expect(bb.upper[0].value).toBeGreaterThan(bb.mid[0].value);
  });
});

describe('depth chart', () => {
  it('builds cumulative depth', () => {
    const series = buildDepthSeries(
      [{ price: '100', quantity: '1' }, { price: '99', quantity: '2' }],
      [{ price: '101', quantity: '1.5' }, { price: '102', quantity: '1' }],
    );
    expect(series.hasDepth).toBe(true);
    expect(series.mid).toBe(100.5);
    expect(series.maxCum).toBeGreaterThan(0);
  });
});
