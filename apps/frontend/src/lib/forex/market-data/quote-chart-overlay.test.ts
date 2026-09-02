/**
 * Run: npx tsx apps/frontend/src/lib/forex/market-data/quote-chart-overlay.test.ts
 */
import { decideQuoteChartOverlay } from './quote-chart-overlay';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testAligned(): void {
  const r = decideQuoteChartOverlay({ lastClose: 1.1578, bid: 1.1577, ask: 1.1579 });
  assert(r.overlay === true, 'aligned quote overlays');
}

function testDivergent(): void {
  const r = decideQuoteChartOverlay({ lastClose: 1.1578, bid: 1.085, ask: 1.0851 });
  assert(r.overlay === false && r.reason === 'QUOTE_CANDLE_DIVERGENCE', 'divergent suppressed');
}

function testNoCandles(): void {
  const r = decideQuoteChartOverlay({ lastClose: null, bid: 1.1, ask: 1.2 });
  assert(r.overlay === false && r.reason === 'NO_CANDLES', 'no candles');
}

testAligned();
testDivergent();
testNoCandles();
console.log('quote-chart-overlay.test.ts ok');
