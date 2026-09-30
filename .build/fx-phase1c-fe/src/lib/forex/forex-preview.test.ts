/**
 * Phase 10.4 targeted preview tests.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-preview.test.ts
 */
import {
  idlePreviewView,
  interpretForexPreviewResult,
  isPreviewParamComplete,
  isStalePreviewRequest,
  loadingPreviewView,
  previewRequestKey,
} from './models/preview';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const req = { symbol: 'EURUSD', side: 'buy' as const, orderType: 'market' as const, volume: '1.00' };

function testRequestConstruction(): void {
  assert(previewRequestKey(req) === 'EURUSD|buy|market|1.00|', 'key');
  assert(isPreviewParamComplete(req), 'market complete');
  assert(
    !isPreviewParamComplete({ symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '1.00' }),
    'limit needs price'
  );
}

function testLoadingReadyBlocked(): void {
  assert(loadingPreviewView(req).status === 'LOADING', 'loading');
  assert(idlePreviewView().data === null, 'idle has no numbers');

  const ready = interpretForexPreviewResult({
    request: req,
    ok: true,
    data: {
      allowed: true,
      reason: null,
      indicative: true,
      source: 'SIMULATED',
      executionMode: 'MOCK',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '1.00',
      referencePrice: '1.16623',
      referenceSide: 'ASK',
      requiredMargin: '2332.46',
      estimatedFee: '0',
    },
  });
  assert(ready.status === 'READY', 'ready');
  assert(ready.data?.requiredMargin === '2332.46', 'backend margin kept');
  assert(ready.data?.referenceSide === 'ASK', 'buy ask');

  const blocked = interpretForexPreviewResult({
    request: req,
    ok: true,
    data: { ...ready.data, allowed: false, reason: 'INSUFFICIENT_FOREX_BALANCE' },
  });
  assert(blocked.status === 'BLOCKED', 'blocked');
  assert(blocked.data?.reason === 'INSUFFICIENT_FOREX_BALANCE', 'reason preserved');
}

function testStaleAndRace(): void {
  assert(isStalePreviewRequest({ key: 'a', generation: 2 }, { key: 'a', generation: 1 }), 'stale gen');
  const stillReady = interpretForexPreviewResult({
    request: req,
    ok: true,
    liveQuoteSequence: '11',
    data: {
      allowed: true,
      reason: null,
      indicative: true,
      source: 'SIMULATED',
      executionMode: 'MOCK',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '1.00',
      quoteSequence: '10',
    },
  });
  assert(stillReady.status === 'READY', 'allowed preview stays usable while MOCK ticks');
}

function testErrorNoLocalFinance(): void {
  const missing = interpretForexPreviewResult({
    request: req,
    ok: false,
    error: { code: 'REQUEST_FAILED', message: 'Request failed' },
  });
  assert(missing.status === 'ERROR', 'error');
  assert(missing.data === null, 'no fabricated preview');
  assert(missing.error?.code === 'FOREX_PREVIEW_UNAVAILABLE', 'missing route mapped');
  assert(!missing.error?.message.includes('Something went wrong'), 'precise error');
}

function testNoOptimisticFillInTicket(): void {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../components/forex/ForexOrderTicket.tsx'), 'utf8');
  const engine = fs.readFileSync(path.join(__dirname, 'runtime/useForexOrderEngine.ts'), 'utf8');
  assert(src.includes('engine.place'), 'ticket submits through the order engine');
  assert(engine.includes('forexApi.placeOrder'), 'engine still uses POST /orders');
  assert(engine.includes('generateClientOrderId'), 'browser-safe clientOrderId');
  assert(!engine.includes('crypto.randomUUID()'), 'no Node-only UUID in order engine');
  assert(!src.includes("status: 'FILLED'"), 'no client fill fabrication');
  assert(!src.includes("preview.status === 'STALE'"), 'quote-sequence STALE must not disable BUY/SELL');
}

testRequestConstruction();
testLoadingReadyBlocked();
testStaleAndRace();
testErrorNoLocalFinance();
testNoOptimisticFillInTicket();
console.log('forex-preview.test.ts ok');
