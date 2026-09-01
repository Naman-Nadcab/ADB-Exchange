/**
 * Phase 10.3 — Forex candle contract.
 * Run: npx tsx apps/backend/src/services/forex/forex-phase103-candles.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOREX_CANDLE_MAX_LIMIT,
  FOREX_SUPPORTED_CANDLE_TIMEFRAMES,
  forexCandlesPayload,
} from './market-data/candles.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function testMissingSymbol(): void {
  const r = forexCandlesPayload({});
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
  if (!r.body.success) assert.equal(r.body.error.code, 'FOREX_SYMBOL_REQUIRED');
}

function testUnknownSymbol(): void {
  const r = forexCandlesPayload({ symbol: 'BTCUSDT' });
  assert.equal(r.status, 404);
  assert.equal(r.body.success, false);
  if (!r.body.success) assert.equal(r.body.error.code, 'FOREX_INSTRUMENT_NOT_FOUND');
}

function testUnknownTimeframe(): void {
  const r = forexCandlesPayload({ symbol: 'EURUSD', timeframe: '3m' });
  assert.equal(r.status, 400);
  if (!r.body.success) assert.equal(r.body.error.code, 'FOREX_TIMEFRAME_UNSUPPORTED');
}

function testLimitBounds(): void {
  const bad = forexCandlesPayload({ symbol: 'EURUSD', limit: '0' });
  assert.equal(bad.status, 400);
  if (!bad.body.success) assert.equal(bad.body.error.code, 'FOREX_CANDLE_LIMIT_INVALID');

  const clipped = forexCandlesPayload({ symbol: 'EURUSD', limit: '99999' });
  assert.equal(clipped.status, 200);
  assert.equal(clipped.body.success, true);
  if (clipped.body.success) assert.equal(clipped.body.data.limit, FOREX_CANDLE_MAX_LIMIT);
}

function testRangeValidation(): void {
  const bad = forexCandlesPayload({
    symbol: 'EURUSD',
    from: '2026-09-02T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
  });
  assert.equal(bad.status, 400);
  if (!bad.body.success) assert.equal(bad.body.error.code, 'FOREX_CANDLE_RANGE_INVALID');
}

function testUnavailableEmpty(): void {
  const r = forexCandlesPayload({ symbol: 'eur/usd', timeframe: '1m', limit: '100' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  if (!r.body.success) throw new Error('expected success');
  assert.equal(r.body.data.symbol, 'EURUSD');
  assert.equal(r.body.data.availability, 'UNAVAILABLE');
  assert.equal(r.body.data.reason, 'NO_DURABLE_OHLC');
  assert.equal(r.body.data.source, 'SIMULATED');
  assert.equal(r.body.data.count, 0);
  assert.deepEqual(r.body.data.candles, []);
  assert.deepEqual(r.body.data.supportedTimeframes, []);
  assert.equal(FOREX_SUPPORTED_CANDLE_TIMEFRAMES.length, 0);
}

function testNoFabricationAndNoCryptoCoupling(): void {
  const src = readFileSync(path.join(__dirname, 'market-data/candles.service.ts'), 'utf8');
  assert.equal(src.includes('ohlcv_candles'), false, 'must not read Crypto ohlcv_candles');
  assert.equal(src.includes('/trading/candles'), false, 'must not call Crypto candles');
  assert.equal(src.includes('Math.random'), false, 'must not invent candles');
  assert.equal(src.includes('mockPriceAt'), false, 'must not rebuild history from mock mid');
}

testMissingSymbol();
testUnknownSymbol();
testUnknownTimeframe();
testLimitBounds();
testRangeValidation();
testUnavailableEmpty();
testNoFabricationAndNoCryptoCoupling();
console.log('forex-phase103-candles.test.ts ok');
