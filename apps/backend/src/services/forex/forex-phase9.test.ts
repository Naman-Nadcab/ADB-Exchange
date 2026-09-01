import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexAdvancedRoutes } from '../../routes/forex-advanced.fastify.js';
import { registerForexAccountingRoutes } from '../../routes/forex-accounting.fastify.js';
import { registerForexCustomerOrderRoutes } from '../../routes/forex-orders.fastify.js';
import { FOREX_EQUITY_MODEL } from './accounting/boundary.js';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { getForexCustomerTradingConfig } from './admin/config.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { calculateForexCommission } from './fees/engine.js';
import { resetForexFeePolicyForTests, setForexAccountCommission, setForexGlobalCommission } from './fees/policy.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { reconcileOrderExecution } from './execution/reconcile.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { resetForexLiquidationLocksForTests, setForexAccountLiquidationLock } from './liquidation/lock.js';
import { resetForexLiquidationServiceForTests } from './liquidation/service.js';
import { ForexOrderError } from './orders/models.js';
import { isPendingTriggered } from './orders/pending.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { canOrderTransition } from './orders/states.js';
import { calculateUnrealizedPnl } from './pnl/engine.js';
import { ForexQuoteConversionSource } from './pnl/conversion.js';
import type { ForexPositionFillInput } from './positions/models.js';
import { ForexPositionService, resetForexPositionServiceForTests } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexProtectionServiceForTests } from './protection/service.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { recoverForexRuntime } from './recovery/service.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexRiskLimitsForTests, setForexAccountLimits } from './risk/policy.js';
import { resetForexRiskServiceForTests } from './risk/service.js';
import {
  isForexTradingEligible,
  resetForexSessionExceptionsForTests,
  setForexSessionException,
  setForexSessionNowForTests,
} from './sessions/eligibility.js';
import { calculateForexSwap, isRolloverMoment, isTripleSwapDay } from './swap/engine.js';
import { resetForexSwapPolicyForTests, setForexGlobalSwap, setForexInstrumentSwap } from './swap/policy.js';
import { resetForexSwapServiceForTests } from './swap/service.js';
import { forexWsHub } from './ws/hub.js';
import { isForexAccountPrivateChannel } from './ws/protocol.js';
import type { ForexQuoteDto, ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const USER = 'user-a';
const USER_B = 'user-b';

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook(now = new Date()) {
  const pricing = resetForexPricingServiceForTests();
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }), now);
  return pricing;
}

function fill(overrides: Partial<ForexPositionFillInput> & Pick<ForexPositionFillInput, 'fillId' | 'volume' | 'price'>): ForexPositionFillInput {
  return { accountId: USER, symbol: 'EURUSD', side: 'buy', timestamp: new Date().toISOString(), ...overrides };
}

function weekday() {
  setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
}

function harness() {
  weekday();
  resetForexAccountPoliciesForTests();
  resetForexLiquidationLocksForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetForexFeePolicyForTests();
  resetForexSwapPolicyForTests();
  resetForexSessionExceptionsForTests();
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const prot = resetForexProtectionServiceForTests(positions, orders, pricing);
  const liq = resetForexLiquidationServiceForTests(positions, orders, acc);
  const risk = resetForexRiskServiceForTests(positions, pricing);
  const swaps = resetForexSwapServiceForTests(positions, acc);
  positions.attachProtection(prot);
  return { pricing, positions, orders, acc, prot, liq, risk, swaps, exec };
}

async function funded() {
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '100000', idempotencyKey: `DEPOSIT:p9-${h.orders.store.snapshot().length}-${Date.now()}`, type: 'DEPOSIT' });
  return h;
}

function usableQuote(pricing: ReturnType<typeof seedBook>, patch: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  const q = pricing.getQuote('EURUSD')!;
  return { ...q, freshness: 'FRESH', quality: 'OK', status: 'TRADEABLE', ...patch };
}

{
  assert.equal(canOrderTransition('VALIDATING', 'ACCEPTED'), true);
  assert.equal(canOrderTransition('PENDING', 'TRIGGERING'), true);
  assert.equal(canOrderTransition('TRIGGERING', 'CANCELLED'), true);
  assert.equal(canOrderTransition('FILLED', 'PENDING'), false);
  assert.equal(FOREX_EQUITY_MODEL.equity, 'ledgerBalance + unrealizedPnl');
  assert.ok(getForexCustomerTradingConfig().orderTypes.includes('limit'));
}

{
  const { orders } = await funded();
  const mkt = await orders.place(USER, {
    clientOrderId: 'p9-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(mkt.status, 'FILLED');
  assert.equal(mkt.source, 'SIMULATED');
  assert.equal(mkt.executionMode, 'MOCK');
}

{
  const { orders, pricing } = await funded();
  const buyLim = await orders.place(USER, {
    clientOrderId: 'p9-bl',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(buyLim.status, 'PENDING');
  assert.equal(buyLim.requestedPrice, '1.16000');
  assert.equal(buyLim.executionId, null);
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.15990', bid: '1.15980', edaReceiveSequence: 'p9-bl' }));
  const after = await orders.getOwned(USER, buyLim.orderId);
  assert.equal(after.status, 'FILLED');
}

{
  const { orders, pricing } = await funded();
  const sellLim = await orders.place(USER, {
    clientOrderId: 'p9-sl',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.17000',
  });
  assert.equal(sellLim.status, 'PENDING');
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.17010', ask: '1.17020', edaReceiveSequence: 'p9-sl' }));
  assert.equal((await orders.getOwned(USER, sellLim.orderId)).status, 'FILLED');
}

{
  const { orders, pricing } = await funded();
  const buyStop = await orders.place(USER, {
    clientOrderId: 'p9-bs',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.17000',
  });
  assert.equal(buyStop.status, 'PENDING');
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.17010', bid: '1.17000', edaReceiveSequence: 'p9-bs' }));
  assert.equal((await orders.getOwned(USER, buyStop.orderId)).status, 'FILLED');
}

{
  const { orders, pricing } = await funded();
  const sellStop = await orders.place(USER, {
    clientOrderId: 'p9-ss',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(sellStop.status, 'PENDING');
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.15990', ask: '1.16000', edaReceiveSequence: 'p9-ss' }));
  assert.equal((await orders.getOwned(USER, sellStop.orderId)).status, 'FILLED');
}

{
  const { orders } = await funded();
  const missing = await orders.place(USER, {
    clientOrderId: 'p9-bad-stop',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
  });
  assert.equal(missing.status, 'REJECTED');
  assert.equal(missing.failureReason, 'INVALID_PRICE');
}

{
  const q = {
    bid: '1.16621',
    ask: '1.16622',
  } as ForexQuoteDto;
  assert.equal(isPendingTriggered({ orderType: 'limit', side: 'buy', requestedPrice: '1.16622' }, q), true);
  assert.equal(isPendingTriggered({ orderType: 'limit', side: 'buy', requestedPrice: '1.16000' }, q), false);
  assert.equal(isPendingTriggered({ orderType: 'stop', side: 'sell', requestedPrice: '1.16621' }, q), true);
}

{
  const { orders, pricing } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'p9-cancel',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  const c1 = await orders.cancel(USER, o.orderId);
  const c2 = await orders.cancel(USER, o.orderId);
  assert.equal(c1.status, 'CANCELLED');
  assert.equal(c2.status, 'CANCELLED');
  assert.equal(c1.orderId, c2.orderId);
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.15990', bid: '1.15980', edaReceiveSequence: 'p9-cxl' }));
  assert.equal((await orders.getOwned(USER, o.orderId)).status, 'CANCELLED');
}

{
  const { orders, pricing } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'p9-race',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  const quote = usableQuote(pricing, { ask: '1.15990', bid: '1.15980', edaReceiveSequence: 'p9-race' });
  const [left, right] = await Promise.allSettled([orders.evaluateQuote(quote), orders.cancel(USER, o.orderId)]);
  assert.equal(left.status, 'fulfilled');
  const final = await orders.getOwned(USER, o.orderId);
  assert.ok(final.status === 'FILLED' || final.status === 'CANCELLED');
  if (final.status === 'CANCELLED') assert.equal(right.status, 'fulfilled');
  if (final.status === 'FILLED') {
    assert.ok(final.executionId);
    assert.equal(final.fillIds.length, 1);
  }
}

{
  const { orders } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'p9-mod',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  const m1 = await orders.modify(USER, o.orderId, { requestedPrice: '1.16100', volume: '0.20', expectedVersion: 1, idempotencyKey: 'mod-1' });
  assert.equal(m1.requestedPrice, '1.16100');
  assert.equal(m1.requestedVolume, '0.20');
  assert.equal(m1.orderId, o.orderId);
  assert.equal(m1.version, 2);
  const replay = await orders.modify(USER, o.orderId, { requestedPrice: '1.16200', expectedVersion: 2, idempotencyKey: 'mod-1' });
  assert.equal(replay.requestedPrice, '1.16100');
  let conflict = false;
  try {
    await orders.modify(USER, o.orderId, { requestedPrice: '1.16200', expectedVersion: 1 });
  } catch (e) {
    conflict = e instanceof ForexOrderError && e.reason === 'MODIFY_VERSION_CONFLICT';
  }
  assert.equal(conflict, true);
  const filled = await orders.place(USER, {
    clientOrderId: 'p9-mod-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  let term = false;
  try {
    await orders.modify(USER, filled.orderId, { requestedPrice: '1.16000' });
  } catch (e) {
    term = e instanceof ForexOrderError && e.reason === 'MODIFY_NOT_SUPPORTED';
  }
  assert.equal(term, true);
}

{
  const { orders } = await funded();
  const first = await orders.place(USER, {
    clientOrderId: 'p9-idem',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  const second = await orders.place(USER, {
    clientOrderId: 'p9-idem',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(first.orderId, second.orderId);
}

{
  resetForexFeePolicyForTests();
  setForexGlobalCommission({ model: 'per_lot', rate: '7', minimum: '1' });
  setForexAccountCommission(USER, { buyRate: '8', sellRate: '6', model: 'per_side', minimum: '0' });
  const buy = calculateForexCommission({ accountId: USER, symbol: 'EURUSD', side: 'buy', volume: '0.10', price: '1.16622' });
  const sell = calculateForexCommission({ accountId: USER, symbol: 'EURUSD', side: 'sell', volume: '0.10', price: '1.16622' });
  assert.equal(buy.amount, '0.8');
  assert.equal(sell.amount, '0.6');
  assert.equal(buy.source, 'SIMULATED');
}

{
  const { orders, acc } = await funded();
  setForexGlobalCommission({ model: 'per_lot', rate: '10' });
  const o = await orders.place(USER, {
    clientOrderId: 'p9-fee',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(o.status, 'FILLED');
  const fees = acc.feeSummary(USER);
  assert.equal(fees.fees, '-1');
  assert.ok(acc.ledger.store.getByKey(`FEE:${o.fillIds[0]}`));
}

{
  resetForexSwapPolicyForTests();
  setForexGlobalSwap({ longSwap: '-2', shortSwap: '1.5', tripleSwapDay: 3, rolloverTime: '21:00' });
  setForexInstrumentSwap('EURUSD', { longSwap: '-2' });
  const wed = new Date('2026-09-02T21:00:00.000Z');
  assert.equal(isTripleSwapDay(wed, 3), true);
  assert.equal(isRolloverMoment(wed, '21:00'), true);
  assert.equal(isRolloverMoment(new Date('2026-09-02T20:59:00.000Z'), '21:00'), false);
  const triple = calculateForexSwap({ symbol: 'EURUSD', side: 'long', volume: '1.00', at: wed });
  assert.equal(triple.triple, true);
  assert.equal(triple.amount, '-6');
  const tue = calculateForexSwap({ symbol: 'EURUSD', side: 'long', volume: '1.00', at: new Date('2026-09-01T21:00:00.000Z') });
  assert.equal(tue.triple, false);
  assert.equal(tue.amount, '-2');
}

{
  const { positions, acc, swaps } = harness();
  setForexGlobalSwap({ longSwap: '-2', tripleSwapDay: 3, rolloverTime: '21:00' });
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p9sw', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'p9-sw-open', volume: '1.00', price: '1.16622' }));
  const early = await swaps.applyRollover(new Date('2026-09-02T20:00:00.000Z'));
  assert.equal(early.length, 0);
  const first = await swaps.applyRollover(new Date('2026-09-02T21:00:00.000Z'));
  assert.equal(first.length, 1);
  assert.equal(first[0]?.triple, true);
  const replay = await swaps.applyRollover(new Date('2026-09-02T21:05:00.000Z'));
  assert.equal(replay.length, 0);
  assert.equal(acc.swapSummary(USER).swaps, '-6');
}

{
  setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
  const open = isForexTradingEligible();
  assert.equal(open.open, true);
  assert.ok(open.sessions.length >= 1);
  setForexSessionNowForTests(new Date('2026-09-05T12:00:00.000Z'));
  const sat = isForexTradingEligible();
  assert.equal(sat.open, false);
  assert.equal(sat.reason, 'WEEKEND_CLOSURE');
  setForexSessionNowForTests(new Date('2026-09-04T21:30:00.000Z'));
  const fri = isForexTradingEligible();
  assert.equal(fri.open, false);
  setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
  setForexSessionException({ date: '2026-09-01', kind: 'holiday', notes: 'test fixture only' });
  const hol = isForexTradingEligible();
  assert.equal(hol.open, false);
  assert.equal(hol.reason, 'HOLIDAY_CLOSURE');
  assert.equal(hol.holidayCoverage, 'CONFIGURED');
  resetForexSessionExceptionsForTests();
  weekday();
}

{
  const { orders } = harness();
  setForexSessionNowForTests(new Date('2026-09-05T12:00:00.000Z'));
  const closed = await orders.place(USER, {
    clientOrderId: 'p9-wknd',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(closed.status, 'REJECTED');
  assert.equal(closed.failureReason, 'SESSION_CLOSED');
  weekday();
}

{
  const { acc, positions, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p9pnl', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'p9-long', volume: '1.00', price: '1.16622' }));
  const q = pricing.getQuote('EURUSD')!;
  const uLong = calculateUnrealizedPnl({
    position: positions.listOwned(USER, true)[0]!,
    quote: q,
    rates: new ForexQuoteConversionSource(pricing),
  });
  assert.equal(uLong.priceSource, 'BID');
  await positions.applyFill(fill({ fillId: 'p9-close', side: 'sell', volume: '1.00', price: '1.16650' }));
  const rec = acc.reconcile(USER);
  assert.equal(rec.ok, true);
  const realized = acc.realizedPosted(USER);
  await positions.applyFill(fill({ fillId: 'p9-short', side: 'sell', volume: '0.50', price: '1.16650' }));
  const uShort = calculateUnrealizedPnl({
    position: positions.listOwned(USER, true)[0]!,
    quote: q,
    rates: new ForexQuoteConversionSource(pricing),
  });
  assert.equal(uShort.priceSource, 'ASK');
  assert.equal(acc.realizedPosted(USER), realized);
}

{
  const { orders, acc, positions, exec } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'p9-exec-rec',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  const ex = exec.get(o.clientExecId);
  const er = reconcileOrderExecution({ order: o, execution: ex, positions: positions.listOwned(USER, false) });
  assert.equal(er.ok, true);
  const missing = reconcileOrderExecution({ order: { ...o, status: 'FILLED', executionId: o.executionId }, execution: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'MISSING_EXECUTION');
  const ledger = acc.reconcile(USER);
  assert.equal(ledger.ok, true);
}

{
  const { orders, acc, positions, prot, liq, risk, swaps } = await funded();
  const pending = await orders.place(USER, {
    clientOrderId: 'p9-recov',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  pending.status = 'TRIGGERING';
  const recovered = recoverForexRuntime({ orders, positions, accounting: acc, protections: prot, liquidations: liq, risk, swaps });
  assert.ok(recovered.orders >= 1);
  assert.equal((await orders.getOwned(USER, pending.orderId)).status, 'FAILED');
  assert.equal((await orders.getOwned(USER, pending.orderId)).failureReason, 'RECOVERY_FAIL_CLOSED');
}

{
  const { orders } = await funded();
  setForexAccountLimits(USER, { maxOrderVolume: '0.05' });
  const pending = await orders.place(USER, {
    clientOrderId: 'p9-risk-pend',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(pending.status, 'REJECTED');
}

{
  const { orders, pricing } = await funded();
  setForexAccountLimits(USER, { maxOrderVolume: '1' });
  const o = await orders.place(USER, {
    clientOrderId: 'p9-trig-risk',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(o.status, 'PENDING');
  setForexAccountLimits(USER, { maxOrderVolume: '0.05' });
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.15990', bid: '1.15980', edaReceiveSequence: 'p9-trisk' }));
  const after = await orders.getOwned(USER, o.orderId);
  assert.equal(after.status, 'FAILED');
  assert.equal(after.failureReason, 'RISK_REJECTED');
}

{
  const { orders, prot, acc, positions } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'p9-sltp',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(o.status, 'FILLED');
  const pos = positions.listOwned(USER, true)[0]!;
  const sl = await prot.create(USER, {
    clientProtectionId: 'p9-sl',
    positionId: pos.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  assert.equal(sl.status, 'ACTIVE');
  const pend = await orders.place(USER, {
    clientOrderId: 'p9-sltp-pend',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.15000',
  });
  await orders.cancel(USER, pend.orderId);
  assert.equal(prot.listOwned(USER).find((p) => p.protectionId === sl.protectionId)?.status, 'ACTIVE');
}

{
  const { orders } = harness();
  setForexAccountLiquidationLock(USER, true);
  const locked = await orders.place(USER, {
    clientOrderId: 'p9-liq',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(locked.status, 'REJECTED');
  assert.ok(locked.failureReason === 'ACCOUNT_LIQUIDATION_LOCK' || locked.failureReason === 'LIQUIDATION_ONLY' || locked.failureReason === 'RISK_REJECTED');
}

{
  weekday();
  resetForexFeePolicyForTests();
  resetForexRiskLimitsForTests();
  const pricing = seedBook();
  const positions = resetForexPositionServiceForTests(pricing);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  resetForexAccountingServiceForTests(positions, pricing);
  resetForexRiskServiceForTests(positions, pricing);
  const { resetForexOrderServiceForTests } = await import('./orders/service.js');
  resetForexOrderServiceForTests(exec, positions, pricing);
  const app = Fastify();
  let uid: string | null = USER;
  app.decorate(
    'authenticate',
    (async (request: { user?: { id: string; role: string; sessionId: string } }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
      if (!uid) {
        reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED' } });
        return;
      }
      request.user = { id: uid, role: 'user', sessionId: 's' };
    }) as never
  );
  await registerForexCustomerOrderRoutes(app);
  await registerForexAccountingRoutes(app);
  await registerForexAdvancedRoutes(app);
  await app.ready();
  uid = null;
  assert.equal((await app.inject({ method: 'GET', url: '/orders/pending' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/fills' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/fees' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/swaps' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/account/summary' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/pnl' })).statusCode, 401);
  uid = USER;
  const pending = await app.inject({ method: 'GET', url: '/orders/pending' });
  assert.equal(pending.statusCode, 200);
  assert.equal(pending.json().data.source, 'SIMULATED');
  uid = USER_B;
  const other = await app.inject({ method: 'GET', url: '/account/summary' });
  assert.equal(other.statusCode, 200);
  assert.equal(other.json().data.cryptoAuthority, false);
  await app.close();
}

{
  assert.equal(isForexAccountPrivateChannel('fx.fill'), true);
  class FakeSock {
    readyState = 1;
    sent: string[] = [];
    send(s: string) {
      this.sent.push(s);
    }
  }
  const a = new FakeSock();
  const b = new FakeSock();
  const idA = forexWsHub.register(a as unknown as import('ws').WebSocket, USER);
  const idB = forexWsHub.register(b as unknown as import('ws').WebSocket, USER_B);
  assert.equal(forexWsHub.subscribe(idA, 'fx.fill'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.fill'), true);
  forexWsHub.publishPrivate(USER, 'fx.fill', { source: 'SIMULATED', secret: 'fill-a' });
  assert.ok(a.sent.some((s) => s.includes('fill-a')));
  assert.equal(b.sent.some((s) => s.includes('fill-a')), false);
}

{
  const files = [
    'services/forex/orders/pending.ts',
    'services/forex/orders/service.ts',
    'services/forex/fees/engine.ts',
    'services/forex/swap/service.ts',
    'services/forex/sessions/eligibility.ts',
    'routes/forex-advanced.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('Math.random'), false);
  }
}

setForexSessionNowForTests(null);
resetForexFeePolicyForTests();
resetForexSwapPolicyForTests();
resetForexSessionExceptionsForTests();
console.log('forex-phase9.test: ok');
