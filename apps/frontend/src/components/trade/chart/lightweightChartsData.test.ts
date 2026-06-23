import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCandles, sanitizeTradeMarkers } from './lightweightChartsData';

test('sanitizeCandles enforces ascending unique times and valid OHLC', () => {
  const out = sanitizeCandles([
    { time: 3, open: 10, high: 12, low: 9, close: 11, volume: 2 },
    { time: 2, open: 8, high: 7, low: 8, close: 9, volume: -2 },
    { time: 2, open: 9, high: 11, low: 8, close: 10, volume: 5 },
    { time: 1, open: Number.NaN, high: 2, low: 1, close: 2, volume: 3 },
  ]);

  assert.deepEqual(
    out.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume]),
    [
      [2, 9, 11, 8, 10, 5],
      [3, 10, 12, 9, 11, 2],
    ]
  );
});

test('sanitizeTradeMarkers enforces strict ascending unique marker timestamps', () => {
  const out = sanitizeTradeMarkers([
    { time: 20, price: 1.5, side: 'buy' },
    { time: 10, price: 1.1, side: 'sell' },
    { time: 20, price: 1.6, side: 'sell' },
    { time: 12, price: Number.NaN, side: 'buy' },
    { time: 25, price: 0, side: 'buy' },
  ]);

  assert.deepEqual(
    out.map((m) => [m.time, m.price, m.side]),
    [
      [10, 1.1, 'sell'],
      [20, 1.6, 'sell'],
    ]
  );
});
