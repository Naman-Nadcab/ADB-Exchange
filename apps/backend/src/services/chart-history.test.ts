import test from 'node:test';
import assert from 'node:assert/strict';
import { needsChartHistoryBackfill, referenceKline } from './chart-history.js';

test('a short or flat series needs a full OHLC backfill', () => {
  assert.equal(needsChartHistoryBackfill(1114, 1100), true);
  assert.equal(needsChartHistoryBackfill(120, 10), true);
  assert.equal(needsChartHistoryBackfill(1000, 40), false);
});

test('reference klines keep OHLC and drop venue volume', () => {
  const row = referenceKline([
    1_700_000_000_000,
    '100.5',
    '110',
    '99.5',
    '108',
    '999',
    1_700_000_059_999,
    '50000',
    42,
  ]);
  assert.ok(row);
  assert.equal(row?.open, '100.5');
  assert.equal(row?.high, '110');
  assert.equal(row?.low, '99.5');
  assert.equal(row?.close, '108');
  assert.equal(referenceKline([1, '0', '1', '1', '1', '0', 2, '0', 0]), null);
});
