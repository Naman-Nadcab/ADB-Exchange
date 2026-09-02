import assert from 'node:assert/strict';
import {
  aggregateDailyTo1W,
  aggregateFifteenTo30m,
  aggregateHourlyTo4h,
  alignBarsToTimeframe,
  parseYahooChart,
  weekStartUtcMs,
  yahooSymbolFor,
} from './ohlc-yahoo.js';

function testParse(): void {
  const bars = parseYahooChart({
    chart: {
      result: [
        {
          timestamp: [1_704_067_200, 1_704_153_600],
          indicators: {
            quote: [
              {
                open: [1.1, 1.2],
                high: [1.15, 1.25],
                low: [1.05, 1.15],
                close: [1.12, 1.22],
              },
            ],
          },
        },
      ],
    },
  });
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.open, '1.1');
  assert.equal(bars[1]?.close, '1.22');
}

function testSkipInvalid(): void {
  const bars = parseYahooChart({
    chart: {
      result: [
        {
          timestamp: [1, 2],
          indicators: { quote: [{ open: [1, null], high: [2, 2], low: [0.5, 1], close: [1.5, 1.5] }] },
        },
      ],
    },
  });
  assert.equal(bars.length, 1);
}

function testMap(): void {
  assert.equal(yahooSymbolFor('EURUSD')?.yahoo, 'EURUSD=X');
  assert.equal(yahooSymbolFor('XAUUSD')?.yahoo, 'GC=F');
  assert.equal(yahooSymbolFor('UNKNOWN'), null);
}

function testAggregate4h(): void {
  const bars = aggregateHourlyTo4h([
    { timestamp: '2026-01-01T00:00:00.000Z', open: '1.10', high: '1.12', low: '1.09', close: '1.11' },
    { timestamp: '2026-01-01T01:00:00.000Z', open: '1.11', high: '1.15', low: '1.10', close: '1.14' },
    { timestamp: '2026-01-01T04:00:00.000Z', open: '1.14', high: '1.16', low: '1.13', close: '1.15' },
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.timestamp, '2026-01-01T00:00:00.000Z');
  assert.equal(bars[0]?.open, '1.10');
  assert.equal(bars[0]?.high, '1.15');
  assert.equal(bars[0]?.low, '1.09');
  assert.equal(bars[0]?.close, '1.14');
  assert.equal(bars[1]?.open, '1.14');
  assert.equal(bars[1]?.close, '1.15');
}

function testAggregate30m(): void {
  const bars = aggregateFifteenTo30m([
    { timestamp: '2026-01-01T00:00:00.000Z', open: '1.10', high: '1.12', low: '1.09', close: '1.11' },
    { timestamp: '2026-01-01T00:15:00.000Z', open: '1.11', high: '1.15', low: '1.10', close: '1.14' },
    { timestamp: '2026-01-01T00:30:00.000Z', open: '1.14', high: '1.16', low: '1.13', close: '1.15' },
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.timestamp, '2026-01-01T00:00:00.000Z');
  assert.equal(bars[0]?.open, '1.10');
  assert.equal(bars[0]?.high, '1.15');
  assert.equal(bars[0]?.low, '1.09');
  assert.equal(bars[0]?.close, '1.14');
  assert.equal(bars[1]?.timestamp, '2026-01-01T00:30:00.000Z');
}

function testAggregate1W(): void {
  const bars = aggregateDailyTo1W([
    { timestamp: '2026-01-05T00:00:00.000Z', open: '1.10', high: '1.12', low: '1.09', close: '1.11' }, // Mon
    { timestamp: '2026-01-06T00:00:00.000Z', open: '1.11', high: '1.15', low: '1.10', close: '1.14' }, // Tue
    { timestamp: '2026-01-12T00:00:00.000Z', open: '1.14', high: '1.16', low: '1.13', close: '1.15' }, // next Mon
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.timestamp, new Date(weekStartUtcMs(Date.parse('2026-01-05T00:00:00.000Z'))).toISOString());
  assert.equal(bars[0]?.open, '1.10');
  assert.equal(bars[0]?.high, '1.15');
  assert.equal(bars[0]?.close, '1.14');
  assert.equal(bars[1]?.open, '1.14');
}

function testAlignPartialLast(): void {
  const bars = alignBarsToTimeframe(
    [
      { timestamp: '2026-01-01T00:00:00.000Z', open: '1.10', high: '1.12', low: '1.09', close: '1.11' },
      { timestamp: '2026-01-01T00:01:37.000Z', open: '1.11', high: '1.13', low: '1.10', close: '1.12' },
    ],
    '1m'
  );
  assert.equal(bars.length, 2);
  assert.equal(bars[1]?.timestamp, '2026-01-01T00:01:00.000Z');
}

testParse();
testSkipInvalid();
testMap();
testAggregate4h();
testAggregate30m();
testAggregate1W();
testAlignPartialLast();
console.log('ohlc-yahoo.test.ts ok');
