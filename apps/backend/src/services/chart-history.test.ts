import test from 'node:test';
import assert from 'node:assert/strict';
import {
  needsChartHistoryBackfill,
  needsChartTailSync,
  referenceKline,
  referenceTailLimit,
  seriesHasReferenceGap,
} from './chart-history.js';

test('a short or flat series needs a full OHLC backfill', () => {
  assert.equal(needsChartHistoryBackfill(1114, 1100), true);
  assert.equal(needsChartHistoryBackfill(120, 10), true);
  assert.equal(needsChartHistoryBackfill(1000, 40), false);
  assert.equal(needsChartHistoryBackfill(1000, 40, 1000, 8), true);
  assert.equal(needsChartHistoryBackfill(1000, 40, 1000, 0), false);
});

test('a full series still needs a short tail when the newest bar is behind', () => {
  const intervalSec = 60;
  const nowMs = Date.parse('2026-10-06T18:32:00.000Z');
  const currentOpen = Math.floor(nowMs / 60_000) * 60_000;
  assert.equal(needsChartTailSync(currentOpen, intervalSec, nowMs), false);
  assert.equal(needsChartTailSync(currentOpen - 60_000, intervalSec, nowMs), false);
  assert.equal(needsChartTailSync(currentOpen - 120_000, intervalSec, nowMs), true);
  assert.equal(needsChartTailSync(null, intervalSec, nowMs), true);
  assert.equal(needsChartTailSync(currentOpen - 3_600_000, 3600, nowMs), false);
});

test('a hole behind a fresh tip asks for a tail the size of the hole', () => {
  assert.equal(seriesHasReferenceGap(1000), false);
  assert.equal(seriesHasReferenceGap(825), true);
  assert.equal(referenceTailLimit(1000), 30);
  assert.equal(referenceTailLimit(825), 205);
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
