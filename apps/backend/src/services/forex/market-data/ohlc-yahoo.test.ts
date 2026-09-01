import assert from 'node:assert/strict';
import { parseYahooChart, yahooSymbolFor } from './ohlc-yahoo.js';

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

testParse();
testSkipInvalid();
testMap();
console.log('ohlc-yahoo.test.ts ok');
