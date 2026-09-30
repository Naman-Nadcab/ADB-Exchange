/**
 * Phase 10.4 — read-only trade preview.
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/forex-phase104-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { previewForexOrder } from './orders/preview.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexAccountPoliciesForTests, setForexAccountPolicy } from './risk/engine.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';
import type { ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER = 'preview-user';
/** Monday midday UTC — within 24x5 NY session for deterministic validation. */
const OPEN_SESSION_CLOCK = new Date('2026-09-07T16:00:00.000Z');

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function harness() {
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetForexSessionExceptionsForTests();
  setForexSessionNowForTests(OPEN_SESSION_CLOCK);
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }),
    now
  );
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  return { pricing, positions, orders };
}

function snap(h: ReturnType<typeof harness>) {
  return {
    orders: h.orders.listOwned(USER).length,
    positions: h.positions.listOwned(USER, true).length,
    fills: h.orders.listFills(USER).length,
  };
}

function testBuyUsesAsk(): void {
  const h = harness();
  const q = h.pricing.getQuote('EURUSD')!;
  const p = previewForexOrder(USER, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' }, h);
  assert.equal(p.allowed, true);
  assert.equal(p.referenceSide, 'ASK');
  assert.equal(p.referencePrice, q.ask);
  assert.ok(p.requiredMargin);
  assert.ok(p.estimatedFee != null);
  assert.equal(p.indicative, true);
}

function testSellUsesBid(): void {
  const h = harness();
  const q = h.pricing.getQuote('EURUSD')!;
  const p = previewForexOrder(USER, { symbol: 'EURUSD', side: 'sell', orderType: 'market', volume: '0.10' }, h);
  assert.equal(p.allowed, true);
  assert.equal(p.referenceSide, 'BID');
  assert.equal(p.referencePrice, q.bid);
}

function testLimitAndStop(): void {
  const h = harness();
  const limit = previewForexOrder(
    USER,
    { symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '0.10', requestedPrice: '1.16000' },
    h
  );
  assert.equal(limit.allowed, true, limit.reason ?? 'limit');
  const stop = previewForexOrder(
    USER,
    { symbol: 'EURUSD', side: 'sell', orderType: 'stop', volume: '0.10', requestedPrice: '1.15000' },
    h
  );
  assert.equal(stop.allowed, true, stop.reason ?? 'stop');
}

function testInvalidVolumeAndSymbol(): void {
  const h = harness();
  const vol = previewForexOrder(USER, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.001' }, h);
  assert.equal(vol.allowed, false);
  assert.equal(vol.reason, 'INVALID_VOLUME_STEP');
  assert.equal(vol.requiredMargin, undefined);
  const sym = previewForexOrder(USER, { symbol: 'BTCUSDT', side: 'buy', orderType: 'market', volume: '0.10' }, h);
  assert.equal(sym.allowed, false);
  assert.equal(sym.reason, 'UNKNOWN_INSTRUMENT');
}

function testStaleMissingQuote(): void {
  const h = harness();
  const p = previewForexOrder(USER, { symbol: 'GBPUSD', side: 'buy', orderType: 'market', volume: '0.10' }, h);
  assert.equal(p.allowed, false);
  assert.equal(p.reason, 'STALE_MARKET');
}

function testNoMutation(): void {
  const h = harness();
  const before = snap(h);
  previewForexOrder(USER, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '1.00' }, h);
  previewForexOrder(USER, { symbol: 'EURUSD', side: 'sell', orderType: 'limit', volume: '0.50', requestedPrice: '1.17000' }, h);
  const after = snap(h);
  assert.deepEqual(after, before);
}

function testLowBalanceBlocks(): void {
  const h = harness();
  setForexAccountPolicy(USER, { balanceReference: '1' });
  const p = previewForexOrder(USER, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '5.00' }, h);
  assert.equal(p.allowed, false);
  assert.ok(p.reason);
  assert.deepEqual(snap(h), { orders: 0, positions: 0, fills: 0 });
}

function testNoFabricationInSource(): void {
  const src = readFileSync(path.join(__dirname, 'orders/preview.ts'), 'utf8');
  assert.equal(src.includes('Math.random'), false);
  assert.equal(src.includes('persistNow'), false);
  assert.equal(src.includes('.place('), false);
  assert.equal(src.includes('evaluateOrder'), false);
}

testBuyUsesAsk();
testSellUsesBid();
testLimitAndStop();
testInvalidVolumeAndSymbol();
testStaleMissingQuote();
testNoMutation();
testLowBalanceBlocks();
testNoFabricationInSource();
setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('forex-phase104-preview.test.ts ok');
