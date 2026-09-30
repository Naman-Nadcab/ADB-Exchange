/**
 * Candle engine correctness — no fake market data.
 * Run: npx tsx apps/frontend/src/lib/forex/market-data/candle-engine.test.ts
 */
import { applyTickToCandles, sameCandleSource, timeframeBucketMs } from './candle-engine';
import type { ForexCandle } from '../models/candles';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const seed: ForexCandle[] = [
  { timestamp: '2026-09-02T09:30:00.000Z', open: '1.08504', high: '1.08508', low: '1.08502', close: '1.08508' },
];

function tick(ts: string, mid: string) {
  return { symbol: 'EURUSD', timestamp: ts, mid };
}

function testTimeframes(): void {
  for (const tf of ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const) {
    assert(timeframeBucketMs(tf) != null, `${tf} bucket`);
  }
}

function testUpdateCurrent(): void {
  const r = applyTickToCandles({
    candles: seed,
    timeframe: '1m',
    tick: tick('2026-09-02T09:30:20.000Z', '1.08511'),
    nowMs: Date.parse('2026-09-02T09:30:21.000Z'),
  });
  assert(r.action === 'update-current', 'update current');
  assert(r.candles.length === 1, 'no extra candle');
  assert(r.candles[0].high === '1.08511', 'high');
  assert(r.candles[0].low === '1.08502', 'low');
  assert(r.candles[0].close === '1.08511', 'close');
  assert(r.candles[0].open === '1.08504', 'open preserved');
}

function testNewCandle(): void {
  const r = applyTickToCandles({
    candles: seed,
    timeframe: '1m',
    tick: tick('2026-09-02T09:31:00.000Z', '1.08520'),
    nowMs: Date.parse('2026-09-02T09:31:01.000Z'),
  });
  assert(r.action === 'new-candle', 'new candle');
  assert(r.candles.length === 2, 'two candles');
  assert(r.candles[1].open === '1.08520', 'new open');
}

function testOutOfOrder(): void {
  const r = applyTickToCandles({
    candles: seed,
    timeframe: '1m',
    tick: tick('2026-09-02T09:29:00.000Z', '1.08000'),
    nowMs: Date.parse('2026-09-02T09:30:21.000Z'),
  });
  assert(r.action === 'ignored' && r.reason === 'out-of-order', 'reject backwards');
  assert(r.candles.length === 1, 'unchanged length');
}

function testInvalid(): void {
  const bad = applyTickToCandles({
    candles: seed,
    timeframe: '1m',
    tick: { symbol: 'EURUSD', timestamp: '2026-09-02T09:30:20.000Z', mid: 'NaN' },
    nowMs: Date.parse('2026-09-02T09:30:21.000Z'),
  });
  assert(bad.action === 'ignored', 'reject nan');
  const future = applyTickToCandles({
    candles: seed,
    timeframe: '1m',
    tick: tick('2026-09-02T12:00:00.000Z', '1.09'),
    nowMs: Date.parse('2026-09-02T09:30:21.000Z'),
  });
  assert(future.action === 'ignored' && future.reason === 'future-timestamp', 'reject future');
}

function testMergePolicy(): void {
  assert(!sameCandleSource('EXTERNAL_YAHOO', 'SIMULATED'), 'no yahoo+sim merge');
  assert(sameCandleSource('SIMULATED', 'SIMULATED'), 'same sim source');
}

testTimeframes();
testUpdateCurrent();
testNewCandle();
testOutOfOrder();
testInvalid();
testMergePolicy();
console.log('candle-engine.test.ts ok');
