/**
 * Phase 1C — Stop Limit + Time-in-Force (targeted).
 * Run: FOREX_SILENT_LOG=1 FOREX_DEMO_FUNDING=true FOREX_DEMO_ZERO_SPREAD=true \
 *   npx tsx src/services/forex/forex-phase1c-stoplimit-tif.test.ts
 */
import assert from 'node:assert/strict';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { isStopLimitMarketable, isPendingTriggered } from './orders/pending.js';
import { validateForexOrderRequest } from './orders/validate.js';
import { resetAccountPositionModesForTests, setAccountPositionMode } from './positions/account-mode.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import type { ProviderRawQuote } from './types.js';
import {
  FOREX_CUSTOMER_EXPOSED_ORDER_TYPES,
  FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE,
  FOREX_ENGINE_ORDER_TYPES,
  FOREX_ENGINE_TIME_IN_FORCE,
} from './capabilities/customer-contract.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';

const USER = 'phase1c-user';
const OPEN_SESSION_CLOCK = new Date('2026-09-07T16:00:00.000Z');
resetForexSessionExceptionsForTests();
setForexSessionNowForTests(OPEN_SESSION_CLOCK);

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seed(bid = '1.16000', ask = '1.16000') {
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetAccountPositionModesForTests();
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  for (const [id, code] of [
    [FOREX_PROVIDER_IDS.MOCK_A, 'MOCK-A'],
    [FOREX_PROVIDER_IDS.MOCK_B, 'MOCK-B'],
    [FOREX_PROVIDER_IDS.MOCK_C, 'MOCK-C'],
  ] as const) {
    pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: id, providerCode: code, bid, ask, providerSequence: 1n }), now);
  }
  return pricing;
}

function harness() {
  const pricing = seed();
  setAccountPositionMode(USER, 'NETTING');
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  return { pricing, positions, acc, orders };
}

function setMid(h: ReturnType<typeof harness>, mid: string) {
  const now = new Date();
  for (const [id, code] of [
    [FOREX_PROVIDER_IDS.MOCK_A, 'MOCK-A'],
    [FOREX_PROVIDER_IDS.MOCK_B, 'MOCK-B'],
    [FOREX_PROVIDER_IDS.MOCK_C, 'MOCK-C'],
  ] as const) {
    h.pricing.ingestRaw(
      raw({ symbol: 'EURUSD', providerId: id, providerCode: code, bid: mid, ask: mid, providerSequence: BigInt(Date.now()) }),
      now
    );
  }
}

{
  assert.ok(FOREX_ENGINE_ORDER_TYPES.includes('stop_limit'));
  assert.ok(FOREX_CUSTOMER_EXPOSED_ORDER_TYPES.includes('stop_limit'));
  assert.deepEqual([...FOREX_ENGINE_TIME_IN_FORCE], ['GTC', 'IOC', 'FOK', 'DAY', 'GTD']);
  assert.deepEqual([...FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE], ['GTC', 'IOC', 'FOK', 'DAY', 'GTD']);
  console.log('  PASS  capability contract: Phase 2 customer stop_limit + TIF exposure');
}

{
  const ok = validateForexOrderRequest({
    clientOrderId: 'sl-ok',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16900',
    timeInForce: 'GTC',
  });
  assert.equal(ok.ok, true);

  const badRel = validateForexOrderRequest({
    clientOrderId: 'sl-bad',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.17100',
    timeInForce: 'GTC',
  });
  assert.equal(badRel.ok, false);

  const iocPending = validateForexOrderRequest({
    clientOrderId: 'sl-ioc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16900',
    timeInForce: 'IOC',
  });
  assert.equal(iocPending.ok, false);
  assert.equal((iocPending as { reason: string }).reason, 'UNSUPPORTED_TIME_IN_FORCE');

  const dayMkt = validateForexOrderRequest({
    clientOrderId: 'day-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'DAY',
  });
  assert.equal(dayMkt.ok, false);

  console.log('  PASS  validation stop_limit relations + TIF combinations');
}

{
  const q = { bid: '1.16000', ask: '1.16000' } as never;
  assert.equal(isPendingTriggered({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.16100' }, { ...q, ask: '1.16100', bid: '1.16100' } as never), true);
  assert.equal(isStopLimitMarketable('buy', '1.16050', { ask: '1.16000', bid: '1.16000' } as never), true);
  assert.equal(isStopLimitMarketable('buy', '1.15900', { ask: '1.16000', bid: '1.16000' } as never), false);
  console.log('  PASS  stop_limit trigger + marketable helpers');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-buy', type: 'INITIAL_FUNDING' });
  // limit == stop so trigger is immediately marketable (fills without activate-to-limit hop)
  const o = await h.orders.place(USER, {
    clientOrderId: 'p1c-buy-sl',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.16500',
    limitPrice: '1.16500',
    timeInForce: 'GTC',
  });
  assert.equal(o.status, 'PENDING', o.failureReason);
  assert.equal(o.orderType, 'stop_limit');
  assert.equal(o.limitPrice, '1.16500');
  assert.equal(o.timeInForce, 'GTC');

  setMid(h, '1.16000');
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  assert.equal((await h.orders.getOwned(USER, o.orderId)).status, 'PENDING');

  setMid(h, '1.16500');
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  const after = await h.orders.getOwned(USER, o.orderId);
  assert.equal(after.status, 'FILLED', after.failureReason);
  assert.equal(h.positions.listOwned(USER, true).length, 1);
  assert.equal(h.acc.reconcile(USER).ok, true);
  console.log('  PASS  Buy Stop Limit submit → trigger → fill + ledger');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-sell', type: 'INITIAL_FUNDING' });
  const o = await h.orders.place(USER, {
    clientOrderId: 'p1c-sell-sl',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.15500',
    limitPrice: '1.15500',
    timeInForce: 'GTC',
  });
  assert.equal(o.status, 'PENDING');
  setMid(h, '1.15500');
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  const after = await h.orders.getOwned(USER, o.orderId);
  assert.equal(after.status, 'FILLED', after.failureReason);
  console.log('  PASS  Sell Stop Limit trigger → fill');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-act', type: 'INITIAL_FUNDING' });
  // Buy stop far above; limit below stop but not marketable when ask jumps to stop (ask > limit)
  const o = await h.orders.place(USER, {
    clientOrderId: 'p1c-activate',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16800',
    timeInForce: 'GTC',
  });
  assert.equal(o.status, 'PENDING');
  // Ask hits stop but stays above limit → activate to working limit
  setMid(h, '1.17000');
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  const mid = await h.orders.getOwned(USER, o.orderId);
  assert.equal(mid.orderType, 'limit', `expected activated limit, got ${mid.orderType} ${mid.status}`);
  assert.equal(mid.status, 'PENDING');
  assert.equal(mid.requestedPrice, '1.16800');
  // Now make limit marketable
  setMid(h, '1.16700');
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  assert.equal((await h.orders.getOwned(USER, o.orderId)).status, 'FILLED');
  console.log('  PASS  Stop Limit activates to Limit then fills');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-cx', type: 'INITIAL_FUNDING' });
  const o = await h.orders.place(USER, {
    clientOrderId: 'p1c-cancel',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'GTC',
  });
  const c = await h.orders.cancel(USER, o.orderId);
  assert.equal(c.status, 'CANCELLED');
  const again = await h.orders.cancel(USER, o.orderId);
  assert.equal(again.status, 'CANCELLED');
  console.log('  PASS  cancel before trigger + idempotent cancel');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-id', type: 'INITIAL_FUNDING' });
  const a = await h.orders.place(USER, {
    clientOrderId: 'p1c-idem',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'GTC',
  });
  const b = await h.orders.place(USER, {
    clientOrderId: 'p1c-idem',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'GTC',
  });
  assert.equal(a.orderId, b.orderId);
  console.log('  PASS  Stop Limit idempotent clientOrderId');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-own', type: 'INITIAL_FUNDING' });
  const o = await h.orders.place(USER, {
    clientOrderId: 'p1c-own',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
  });
  await assert.rejects(() => h.orders.getOwned('other-user', o.orderId));
  console.log('  PASS  ownership / IDOR');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-tif', type: 'INITIAL_FUNDING' });
  const gtc = await h.orders.place(USER, {
    clientOrderId: 'p1c-gtc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.10000',
    timeInForce: 'GTC',
  });
  assert.equal(gtc.status, 'PENDING');
  assert.equal(gtc.timeInForce, 'GTC');

  const ioc = await h.orders.place(USER, {
    clientOrderId: 'p1c-ioc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'IOC',
  });
  assert.equal(ioc.status, 'FILLED', ioc.failureReason);
  assert.equal(ioc.timeInForce, 'IOC');

  const fok = await h.orders.place(USER, {
    clientOrderId: 'p1c-fok',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.05',
    timeInForce: 'FOK',
  });
  assert.ok(fok.status === 'FILLED' || fok.status === 'CANCELLED' || fok.status === 'REJECTED', fok.status);

  const day = await h.orders.place(USER, {
    clientOrderId: 'p1c-day',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.19000',
    limitPrice: '1.18900',
    timeInForce: 'DAY',
  });
  assert.equal(day.status, 'PENDING');
  assert.equal(day.timeInForce, 'DAY');
  console.log('  PASS  TIF GTC/IOC/FOK/DAY placement paths');
}

{
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '10000', idempotencyKey: 'p1c-fund-mkt', type: 'INITIAL_FUNDING' });
  const m = await h.orders.place(USER, {
    clientOrderId: 'p1c-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(m.status, 'FILLED');
  const lim = await h.orders.place(USER, {
    clientOrderId: 'p1c-lim',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.10000',
  });
  assert.equal(lim.status, 'PENDING');
  const stop = await h.orders.place(USER, {
    clientOrderId: 'p1c-stop',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.20000',
  });
  assert.equal(stop.status, 'PENDING');
  console.log('  PASS  Market/Limit/Stop regression');
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('forex phase1c stop_limit + TIF: PASS');
