import assert from 'node:assert/strict';
import {
  decodeChainlinkRound,
  foldCandles,
  formatOraclePrice,
  priceInQuote,
  sparklineToPoints,
  window24h,
} from './crypto-market-data.js';
import { filterCandlesNearAnchor } from '../lib/candle-series-filter.js';

const btcAnswer = 8512806972960n;
const updated = 1_791_118_523n;
const words = [
  0n.toString(16).padStart(64, '0'),
  btcAnswer.toString(16).padStart(64, '0'),
  0n.toString(16).padStart(64, '0'),
  updated.toString(16).padStart(64, '0'),
  0n.toString(16).padStart(64, '0'),
];
const decoded = decodeChainlinkRound('0x' + words.join(''), 8, Number(updated) + 30, 86_400);
assert.ok(decoded != null && Math.abs(decoded - 85128.0697296) < 1e-6, `btc decode ${decoded}`);
assert.equal(decodeChainlinkRound('0x' + words.join(''), 8, Number(updated) + 900_000, 86_400), null);

assert.equal(formatOraclePrice(85226.4), '85226.40');
assert.equal(formatOraclePrice(0.00000381), '0.00000381');

const usdt = priceInQuote(85128, 'USDT', 1.0001, 85128);
assert.ok(usdt != null && Math.abs(usdt - 85128 / 1.0001) < 1e-6);
const ethBtc = priceInQuote(2700, 'BTC', 1, 85000);
assert.ok(ethBtc != null && Math.abs(ethBtc - 2700 / 85000) < 1e-12);

const now = 1_700_000_000_000;
const points = sparklineToPoints([100, 110, 90], now);
assert.equal(points.length, 3);
assert.equal(points[2]!.p, 90);
assert.equal(points[1]!.t, points[2]!.t - 3600);

const folded = foldCandles(
  [
    { t: 3600, p: 10 },
    { t: 3660, p: 12 },
    { t: 7200, p: 9 },
  ],
  3600
);
assert.equal(folded.length, 2);
assert.equal(folded[0]!.open, 10);
assert.equal(folded[0]!.high, 12);
assert.equal(folded[0]!.close, 12);
assert.equal(folded[1]!.close, 9);

const day = window24h(
  [
    { t: 1_000, p: 50 },
    { t: 90_000, p: 80 },
    { t: 100_000, p: 70 },
  ],
  100_000
);
assert.ok(day);
assert.equal(day!.open, 80);
assert.equal(day!.high, 80);
assert.equal(day!.low, 70);

const filtered = filterCandlesNearAnchor(
  [
    { close: '100' },
    { close: '85100' },
    { close: '85200' },
  ],
  85200
);
assert.deepEqual(filtered.map((row) => row.close), ['85100', '85200']);

console.log('crypto-market-data tests passed');
