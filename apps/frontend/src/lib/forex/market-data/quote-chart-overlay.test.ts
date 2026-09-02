/**
 * Run: npx tsx apps/frontend/src/lib/forex/market-data/quote-chart-overlay.test.ts
 */
import { decideQuoteChartOverlay } from './quote-chart-overlay';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testAligned(): void {
  const r = decideQuoteChartOverlay({ lastClose: 1.1578, bid: 1.1577, ask: 1.1579 });
  assert(r.overlay === true && r.aligned === true, 'aligned quote overlays');
}

function testDivergent(): void {
  const r = decideQuoteChartOverlay({ lastClose: 1.15942, bid: 1.11783, ask: 1.11783 });
  assert(r.overlay === true, 'live quote still overlays when candles are older');
  assert(r.aligned === false, 'divergence is informational only');
}

function testNoCandles(): void {
  const r = decideQuoteChartOverlay({ lastClose: null, bid: 1.1, ask: 1.1 });
  assert(r.overlay === true, 'quote overlays without candles');
}

testAligned();
testDivergent();
testNoCandles();
console.log('quote-chart-overlay.test.ts ok');
