/**
 * Phase 10.3 targeted candle/chart-state tests.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-candles.test.ts
 */
import {
  interpretForexCandleResult,
  isStaleCandleRequest,
  isValidOhlcRelation,
  loadingForexCandleView,
  validateForexCandlePayload,
} from './models/candles';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function candle(ts: string, o: string, h: string, l: string, c: string) {
  return { timestamp: ts, open: o, high: h, low: l, close: c };
}

function testValidNormalization(): void {
  const ok = validateForexCandlePayload(
    {
      symbol: 'EURUSD',
      timeframe: '1m',
      candles: [
        candle('2026-09-01T00:00:00.000Z', '1.08500', '1.08520', '1.08480', '1.08510'),
        candle('2026-09-01T00:01:00.000Z', '1.08510', '1.08540', '1.08500', '1.08530'),
      ],
    },
    { symbol: 'EURUSD', timeframe: '1m' }
  );
  assert(ok.ok, 'valid candles accepted');
  if (ok.ok) assert(ok.candles.length === 2, 'two candles kept');
}

function testAscendingAndDuplicate(): void {
  const desc = validateForexCandlePayload(
    {
      symbol: 'EURUSD',
      candles: [
        candle('2026-09-01T00:01:00.000Z', '1.1', '1.2', '1.0', '1.1'),
        candle('2026-09-01T00:00:00.000Z', '1.1', '1.2', '1.0', '1.1'),
      ],
    },
    { symbol: 'EURUSD' }
  );
  assert(!desc.ok && desc.code === 'FOREX_CANDLES_ORDER_INVALID', 'descending rejected');

  const dup = validateForexCandlePayload(
    {
      symbol: 'EURUSD',
      candles: [
        candle('2026-09-01T00:00:00.000Z', '1.1', '1.2', '1.0', '1.1'),
        candle('2026-09-01T00:00:00.000Z', '1.1', '1.2', '1.0', '1.15'),
      ],
    },
    { symbol: 'EURUSD' }
  );
  assert(!dup.ok && dup.code === 'FOREX_CANDLES_DUPLICATE_TIMESTAMP', 'duplicate timestamp rejected');
}

function testInvalidOhlc(): void {
  assert(!isValidOhlcRelation({ open: '1.2', high: '1.1', low: '1.0', close: '1.15' }), 'high below open/close');
  assert(!isValidOhlcRelation({ open: '1.2', high: '1.3', low: '1.25', close: '1.15' }), 'low above close');
  const bad = validateForexCandlePayload(
    { symbol: 'EURUSD', candles: [candle('2026-09-01T00:00:00.000Z', '1.2', '1.1', '1.0', '1.15')] },
    { symbol: 'EURUSD' }
  );
  assert(!bad.ok && bad.code === 'FOREX_CANDLES_OHLC_INVALID', 'invalid OHLC rejected');
}

function testSymbolMismatch(): void {
  const bad = validateForexCandlePayload(
    { symbol: 'GBPUSD', candles: [candle('2026-09-01T00:00:00.000Z', '1.2', '1.3', '1.1', '1.25')] },
    { symbol: 'EURUSD' }
  );
  assert(!bad.ok && bad.code === 'FOREX_CANDLES_SYMBOL_MISMATCH', 'symbol mismatch rejected');
}

function testStaleRequestRejection(): void {
  assert(
    isStaleCandleRequest({ symbol: 'GBPUSD', generation: 2 }, { symbol: 'EURUSD', generation: 1 }),
    'older generation is stale'
  );
  assert(
    !isStaleCandleRequest({ symbol: 'GBPUSD', generation: 2 }, { symbol: 'GBPUSD', generation: 2 }),
    'matching request kept'
  );
}

function testLoadingState(): void {
  const v = loadingForexCandleView('eur/usd');
  assert(v.status === 'LOADING', 'loading status');
  assert(v.symbol === 'EURUSD', 'symbol normalized');
  assert(v.candles.length === 0, 'no placeholder candles while loading');
}

function testNoHistoryStates(): void {
  const unavailable = interpretForexCandleResult({
    symbol: 'EURUSD',
    ok: true,
    data: {
      symbol: 'EURUSD',
      timeframe: null,
      source: 'SIMULATED',
      availability: 'UNAVAILABLE',
      reason: 'NO_DURABLE_OHLC',
      supportedTimeframes: [],
      count: 0,
      candles: [],
    },
  });
  assert(unavailable.status === 'NO_HISTORY', 'unavailable → no history');
  assert(unavailable.candles.length === 0, 'no fabricated candles');
  assert(unavailable.supportedTimeframes.length === 0, 'no unsupported timeframe list');

  const missingRoute = interpretForexCandleResult({
    symbol: 'EURUSD',
    ok: false,
    error: { code: 'REQUEST_FAILED', message: 'Request failed' },
  });
  assert(missingRoute.status === 'NO_HISTORY', 'missing route mapped to no-history, not fake data');
}

function testErrorState(): void {
  const err = interpretForexCandleResult({
    symbol: 'EURUSD',
    ok: false,
    error: { code: 'NETWORK_ERROR', message: 'Connection to the Forex API failed' },
  });
  assert(err.status === 'ERROR', 'network stays an error');
  assert(!!err.error && err.error.code === 'NETWORK_ERROR', 'code preserved');
  assert(!!err.error && !err.error.message.includes('Something went wrong'), 'no generic-only copy');
}

function testReadyAndInvalid(): void {
  const ready = interpretForexCandleResult({
    symbol: 'EURUSD',
    timeframe: '1m',
    ok: true,
    data: {
      symbol: 'EURUSD',
      timeframe: '1m',
      availability: 'AVAILABLE',
      supportedTimeframes: ['1m'],
      count: 1,
      candles: [candle('2026-09-01T00:00:00.000Z', '1.08500', '1.08520', '1.08480', '1.08510')],
    },
  });
  assert(ready.status === 'READY', 'authoritative candles renderable');
  assert(ready.candles.length === 1, 'one candle');

  const invalid = interpretForexCandleResult({
    symbol: 'EURUSD',
    ok: true,
    data: {
      symbol: 'EURUSD',
      availability: 'AVAILABLE',
      supportedTimeframes: ['1m'],
      count: 1,
      candles: [candle('2026-09-01T00:00:00.000Z', '1.2', '1.1', '1.0', '1.15')],
    },
  });
  assert(invalid.status === 'INVALID', 'bad OHLC is not silently rendered');
  assert(invalid.candles.length === 0, 'invalid series cleared');
}

testValidNormalization();
testAscendingAndDuplicate();
testInvalidOhlc();
testSymbolMismatch();
testStaleRequestRejection();
testLoadingState();
testNoHistoryStates();
testErrorState();
testReadyAndInvalid();
console.log('forex-candles.test.ts ok');
