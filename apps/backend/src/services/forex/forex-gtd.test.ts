/**
 * GTD server-authoritative expiry.
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/forex-gtd.test.ts
 */
import assert from 'node:assert/strict';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { validateForexOrderRequest } from './orders/validate.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';
import type { ProviderRawQuote } from './types.js';

const USER = 'gtd-user';
resetForexSessionExceptionsForTests();
setForexSessionNowForTests(new Date('2026-09-07T16:00:00.000Z'));

function raw(p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask'>): ProviderRawQuote {
  return {
    providerId: FOREX_PROVIDER_IDS.MOCK_A,
    providerCode: 'MOCK-A',
    providerTimestamp: new Date(),
    providerSequence: 1n,
    source: 'SIMULATED',
    ...p,
  };
}

function harness() {
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(raw({ symbol: 'EURUSD', bid: '1.16000', ask: '1.16006' }), now);
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  return { pricing, orders };
}

{
  const future = new Date(Date.now() + 3600_000).toISOString();
  resetForexSessionExceptionsForTests();
  setForexSessionNowForTests(new Date('2026-09-07T16:00:00.000Z'));
  const ok = validateForexOrderRequest({
    clientOrderId: 'gtd-1',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.15000',
    timeInForce: 'GTD',
    expireAt: future,
  });
  assert.equal(ok.ok, true);
  const bad = validateForexOrderRequest({
    clientOrderId: 'gtd-2',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.15000',
    timeInForce: 'GTD',
  });
  assert.equal(bad.ok, false);
  console.log('  PASS  GTD validation');
}

{
  const { orders } = harness();
  const expMs = Date.now() + 200;
  const future = new Date(expMs).toISOString();
  const o = await orders.place(USER, {
    clientOrderId: 'gtd-pending',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.15000',
    timeInForce: 'GTD',
    expireAt: future,
  });
  assert.equal(o.status, 'PENDING');
  assert.equal(o.timeInForce, 'GTD');
  assert.equal(o.expireAt, future);
  const expired = await orders.expireGtdOrders(new Date(expMs + 5));
  assert.ok(expired.length >= 1);
  const after = await orders.getOwned(USER, o.orderId);
  assert.equal(after.status, 'CANCELLED');
  assert.equal(after.failureReason, 'GTD_ORDER_EXPIRED');
  console.log('  PASS  GTD expiry worker');
}

console.log('forex-gtd.test.ts — all passed');
