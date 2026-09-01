/**
 * Phase 10.5B — reduce-only close + protection lifecycle.
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/forex-phase105b-close.test.ts
 */
import assert from 'node:assert/strict';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { closeForexPosition } from './orders/close.js';
import { ForexOrderError } from './orders/models.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { ForexPositionError } from './positions/models.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { ForexProtectionService } from './protection/service.js';
import { ForexProtectionStore } from './protection/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import type { ProviderRawQuote } from './types.js';

const USER = 'close-user';

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function harness() {
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
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
  const protections = new ForexProtectionService(new ForexProtectionStore(), positions, orders, pricing, false);
  return { pricing, positions, orders, protections };
}

async function openLong(h: ReturnType<typeof harness>, volume = '0.10', id = 'open-long') {
  const order = await h.orders.place(USER, {
    clientOrderId: id,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume,
  });
  assert.equal(order.status, 'FILLED', order.failureReason ?? 'open long');
  const pos = h.positions.listOwned(USER, true).find((p) => p.symbol === 'EURUSD');
  assert.ok(pos, 'long opened');
  return pos!;
}

async function openShort(h: ReturnType<typeof harness>, volume = '0.10', id = 'open-short') {
  const order = await h.orders.place(USER, {
    clientOrderId: id,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume,
  });
  assert.equal(order.status, 'FILLED', order.failureReason ?? 'open short');
  const pos = h.positions.listOwned(USER, true).find((p) => p.symbol === 'EURUSD');
  assert.ok(pos, 'short opened');
  return pos!;
}

async function testFullCloseLong(): Promise<void> {
  const h = harness();
  const pos = await openLong(h);
  const q = h.pricing.getQuote('EURUSD')!;
  const result = await closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'close-full' }, h);
  assert.equal(result.reduceOnly, true);
  assert.equal(result.closeSide, 'sell');
  assert.equal(result.referenceSide, 'BID');
  assert.equal(result.order.status, 'FILLED');
  assert.equal(result.order.side, 'sell');
  assert.equal(result.position?.status, 'CLOSED');
  assert.equal(result.position?.volume, '0');
  assert.equal(h.positions.listOwned(USER, true).length, 0);
  assert.equal(result.order.requestedVolume, pos.volume);
  void q;
}

async function testFullCloseShort(): Promise<void> {
  const h = harness();
  const pos = await openShort(h);
  const result = await closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'close-short' }, h);
  assert.equal(result.closeSide, 'buy');
  assert.equal(result.referenceSide, 'ASK');
  assert.equal(result.order.side, 'buy');
  assert.equal(result.position?.status, 'CLOSED');
  assert.equal(h.positions.listOwned(USER, true).length, 0);
}

async function testPartialClose(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.20', 'open-partial');
  const result = await closeForexPosition(
    USER,
    { positionId: pos.positionId, clientOrderId: 'close-half', volume: '0.10' },
    h
  );
  assert.equal(result.order.status, 'FILLED');
  const after = h.positions.getOwned(USER, pos.positionId);
  assert.equal(after.status, 'OPEN');
  assert.equal(after.side, 'long');
  assert.equal(after.volume, '0.1');
}

async function testNoReversal(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.10', 'open-rev');
  await assert.rejects(
    () => closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'over-close', volume: '0.20' }, h),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'CLOSE_VOLUME_EXCEEDS_POSITION'
  );
  const still = h.positions.getOwned(USER, pos.positionId);
  assert.equal(still.status, 'OPEN');
  assert.equal(still.side, 'long');
  assert.equal(still.volume, pos.volume);
}

async function testRiskGateRejectsReversalIntent(): Promise<void> {
  const h = harness();
  await openLong(h, '0.10', 'open-gate');
  const order = await h.orders.place(USER, {
    clientOrderId: 'gate-reverse',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '1.00',
    intent: 'CUSTOMER_CLOSE',
  });
  assert.equal(order.status, 'REJECTED');
  assert.equal(order.failureReason, 'CLOSE_VOLUME_EXCEEDS_POSITION');
  const still = h.positions.listOwned(USER, true);
  assert.equal(still.length, 1);
  assert.equal(still[0]!.side, 'long');
}

async function testSameSideCloseRejected(): Promise<void> {
  const h = harness();
  await openLong(h, '0.10', 'open-same');
  const order = await h.orders.place(USER, {
    clientOrderId: 'same-side',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.05',
    intent: 'CUSTOMER_CLOSE',
  });
  assert.equal(order.status, 'REJECTED');
  assert.equal(order.failureReason, 'NOT_A_CLOSE');
}

async function testStaleVersion(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.10', 'open-ver');
  await assert.rejects(
    () =>
      closeForexPosition(
        USER,
        { positionId: pos.positionId, clientOrderId: 'stale-ver', expectedVersion: pos.version - 1 },
        h
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'STALE_POSITION'
  );
  assert.equal(h.positions.getOwned(USER, pos.positionId).status, 'OPEN');
}

async function testClosedPosition(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.10', 'open-then-closed');
  await closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'first-close' }, h);
  await assert.rejects(
    () => closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'second-close' }, h),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_CLOSED'
  );
}

async function testProtectionCreateDelete(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.10', 'open-prot');
  const sl = await h.protections.create(USER, {
    clientProtectionId: 'sl-1',
    positionId: pos.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  assert.equal(sl.status, 'ACTIVE');
  assert.equal(sl.type, 'STOP_LOSS');
  const tp = await h.protections.create(USER, {
    clientProtectionId: 'tp-1',
    positionId: pos.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.18000',
  });
  assert.equal(tp.status, 'ACTIVE');
  const cancelled = await h.protections.cancel(USER, sl.protectionId);
  assert.equal(cancelled.status, 'CANCELLED');
  const sl2 = await h.protections.create(USER, {
    clientProtectionId: 'sl-2',
    positionId: pos.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.15500',
  });
  assert.equal(sl2.status, 'ACTIVE');
  assert.notEqual(sl2.protectionId, sl.protectionId);
}

async function testShortProtectionSides(): Promise<void> {
  const h = harness();
  const pos = await openShort(h, '0.10', 'open-short-prot');
  const sl = await h.protections.create(USER, {
    clientProtectionId: 'ssl-1',
    positionId: pos.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.18000',
  });
  const tp = await h.protections.create(USER, {
    clientProtectionId: 'stp-1',
    positionId: pos.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.15000',
  });
  assert.equal(sl.status, 'ACTIVE');
  assert.equal(tp.status, 'ACTIVE');
}

async function testFailedCloseNoMutation(): Promise<void> {
  const h = harness();
  const pos = await openLong(h, '0.10', 'open-fail');
  await assert.rejects(
    () => closeForexPosition(USER, { positionId: pos.positionId, clientOrderId: 'bad-vol', volume: '0' }, h),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'INVALID_VOLUME'
  );
  assert.equal(h.positions.getOwned(USER, pos.positionId).volume, pos.volume);
  assert.equal(h.positions.getOwned(USER, pos.positionId).status, 'OPEN');
}

async function testMissingPosition(): Promise<void> {
  const h = harness();
  await assert.rejects(
    () => closeForexPosition(USER, { positionId: 'missing', clientOrderId: 'no-pos' }, h),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_NOT_FOUND'
  );
}

void (async () => {
  await testFullCloseLong();
  await testFullCloseShort();
  await testPartialClose();
  await testNoReversal();
  await testRiskGateRejectsReversalIntent();
  await testSameSideCloseRejected();
  await testStaleVersion();
  await testClosedPosition();
  await testProtectionCreateDelete();
  await testShortProtectionSides();
  await testFailedCloseNoMutation();
  await testMissingPosition();
  void ForexOrderError;
  console.log('forex-phase105b-close.test.ts ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
