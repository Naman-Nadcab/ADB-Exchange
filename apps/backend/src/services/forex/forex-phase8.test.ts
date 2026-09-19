import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexRiskRoutes } from '../../routes/forex-risk.fastify.js';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { resetForexLiquidationLocksForTests, setForexAccountLiquidationLock } from './liquidation/lock.js';
import { resetForexLiquidationServiceForTests } from './liquidation/service.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import type { ForexPositionFillInput, ForexPositionRecord } from './positions/models.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexProtectionServiceForTests } from './protection/service.js';
import { quoteUsableForTrigger } from './protection/trigger.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { classifyForexOrderRisk } from './risk/classify.js';
import { evaluateDealingControls, getForexDealingSnapshot, resetForexDealingForTests, setForexAccountDealing, setForexEmergencyHalt, setForexSymbolDealing } from './risk/dealing.js';
import { calculateForexExposure } from './risk/exposure.js';
import { resetForexAccountPoliciesForTests, setForexAccountPolicy } from './risk/engine.js';
import { resolveEffectiveLimits, resetForexRiskLimitsForTests, setForexAccountLimits, setForexGlobalLimits, setForexInstrumentLimits } from './risk/policy.js';
import { deriveAccountRiskState, evaluatePreTradeRisk } from './risk/pretrade.js';
import { resetForexRiskServiceForTests } from './risk/service.js';
import { canAccountRiskTransition } from './risk/states.js';
import { forexWsHub } from './ws/hub.js';
import { isForexAccountPrivateChannel } from './ws/protocol.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';
import type { ForexQuoteDto, ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPEN_SESSION_CLOCK = new Date('2026-09-07T16:00:00.000Z');
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

function harness() {
  resetForexAccountPoliciesForTests();
  resetForexLiquidationLocksForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetForexSessionExceptionsForTests();
  setForexSessionNowForTests(OPEN_SESSION_CLOCK);
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const prot = resetForexProtectionServiceForTests(positions, orders, pricing);
  const liq = resetForexLiquidationServiceForTests(positions, orders, acc);
  const risk = resetForexRiskServiceForTests(positions, pricing);
  positions.attachProtection(prot);
  return { pricing, positions, orders, acc, prot, liq, risk };
}

function quoteOf(pricing: ReturnType<typeof seedBook>): ForexQuoteDto {
  return pricing.getQuote('EURUSD')!;
}

{
  assert.equal(canAccountRiskTransition('NORMAL', 'WARNING'), true);
  assert.equal(canAccountRiskTransition('WARNING', 'LIQUIDATION_ONLY'), true);
  assert.equal(canAccountRiskTransition('NORMAL', 'NORMAL'), true);
}

{
  setForexGlobalLimits({ maxOrderVolume: '5', maxPositionVolume: '10' });
  setForexInstrumentLimits('EURUSD', { maxOrderVolume: '2' });
  setForexAccountLimits(USER, { maxOrderVolume: '8' });
  const eff = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: USER });
  assert.equal(eff.maxOrderVolume, '2');
  assert.equal(eff.sources.maxOrderVolume, 'INSTRUMENT');
  resetForexRiskLimitsForTests();
}

{
  const none = classifyForexOrderRisk({ side: 'buy', volume: '1.00', position: null });
  assert.equal(none.direction, 'INCREASING');
  assert.equal(none.kind, 'OPEN');
  const pos = { status: 'OPEN', side: 'long', volume: '2.00' } as ForexPositionRecord;
  assert.equal(classifyForexOrderRisk({ side: 'buy', volume: '1', position: pos }).kind, 'INCREASE');
  assert.equal(classifyForexOrderRisk({ side: 'sell', volume: '1', position: pos }).kind, 'PARTIAL_CLOSE');
  assert.equal(classifyForexOrderRisk({ side: 'sell', volume: '2', position: pos }).kind, 'FULL_CLOSE');
  assert.equal(classifyForexOrderRisk({ side: 'sell', volume: '3', position: pos }).kind, 'REVERSAL');
  assert.equal(classifyForexOrderRisk({ side: 'sell', volume: '3', position: pos }).direction, 'INCREASING');
}

{
  const positions = [
    { positionId: '1', symbol: 'EURUSD', status: 'OPEN', side: 'long', volume: '1', exposure: '100', initialMargin: '10', maintenanceMargin: '5' },
    { positionId: '2', symbol: 'EURUSD', status: 'OPEN', side: 'short', volume: '1', exposure: '40', initialMargin: '4', maintenanceMargin: '2' },
  ] as ForexPositionRecord[];
  const exp = calculateForexExposure(positions);
  assert.equal(exp.accountGross, '140');
  assert.equal(exp.accountNet, '60');
  assert.equal(exp.symbolExposure.EURUSD, '140');
}

{
  const { acc, positions, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'p8-open', volume: '1.00', price: '1.16622' }));
  const q = quoteOf(pricing);
  const cur = positions.listOwned(USER, true);
  const preview = positions.previewAfterFill(fill({ fillId: 'p8-prev', volume: '1.00', price: q.ask }));
  const ok = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.10',
    quote: q,
    currentPositions: cur,
    previewPositions: preview,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(ok.ok, true);

  setForexGlobalLimits({ maxOrderVolume: '0.05' });
  const rej = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.10',
    quote: q,
    currentPositions: cur,
    previewPositions: preview,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(rej.ok, false);
  assert.equal(rej.reason, 'MAX_ORDER_VOLUME');
  resetForexRiskLimitsForTests();

  const stale = { ...q, freshness: 'STALE', quality: 'STALE' } as ForexQuoteDto;
  assert.equal(quoteUsableForTrigger(stale), false);
  const st = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.01',
    quote: stale,
    currentPositions: cur,
    previewPositions: cur,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(st.reason, 'STALE_MARKET');

  const crossed = { ...q, bid: '1.17000', ask: '1.16000', quality: 'CROSSED', status: 'UNAVAILABLE' } as ForexQuoteDto;
  const cr = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.01',
    quote: crossed,
    currentPositions: cur,
    previewPositions: cur,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(cr.reason, 'CROSSED_QUOTE');

  setForexInstrumentLimits('EURUSD', { maxSpread: '0.00001' });
  const sp = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.01',
    quote: q,
    currentPositions: cur,
    previewPositions: preview,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(sp.reason, 'EXCESSIVE_SPREAD');
  resetForexRiskLimitsForTests();

  const dev = evaluatePreTradeRisk({
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '0.01',
    quote: q,
    requestedPrice: '1.20000',
    maxDeviation: '0.00010',
    currentPositions: cur,
    previewPositions: preview,
    allOpenPositions: cur,
    openOrdersForSymbol: 0,
    equity: '100000',
    accountingAvailable: true,
  });
  assert.equal(dev.reason, 'PRICE_DEVIATION_LIMIT');
}

{
  const { orders, acc, positions, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8o', type: 'DEPOSIT' });
  const first = await orders.place(USER, {
    clientOrderId: 'p8-open',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(first.status, 'FILLED');
  const reduce = await orders.place(USER, {
    clientOrderId: 'p8-close-part',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.05',
  });
  assert.equal(reduce.status, 'FILLED');
  assert.ok(positions.listOwned(USER, true).length === 1);

  setForexAccountDealing(USER, { newOrderEnabled: false });
  const blocked = await orders.place(USER, {
    clientOrderId: 'p8-blocked',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
  });
  assert.equal(blocked.status, 'REJECTED');
  assert.equal(blocked.failureReason, 'NEW_ORDERS_DISABLED');
  const stillClose = await orders.place(USER, {
    clientOrderId: 'p8-reduce-ok',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.05',
  });
  assert.equal(stillClose.status, 'FILLED');
  resetForexDealingForTests();

  setForexEmergencyHalt(true, false);
  const halted = await orders.place(USER, {
    clientOrderId: 'p8-halt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
  });
  assert.equal(halted.status, 'REJECTED');
  assert.equal(halted.failureReason, 'FOREX_HALTED');
  setForexEmergencyHalt(false, true);

  const replay = await orders.place(USER, {
    clientOrderId: 'p8-open',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(replay.orderId, first.orderId);

  void pricing;
}

{
  const { orders, acc, prot, positions, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8p', type: 'DEPOSIT' });
  const opened = await positions.applyFill(fill({ fillId: 'p8-sl', volume: '1.00', price: '1.16622' }));
  const sl = await prot.create(USER, {
    clientProtectionId: 'p8-sl',
    positionId: opened!.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  setForexAccountDealing(USER, { newOrderEnabled: false });
  const q = quoteOf(pricing);
  await prot.evaluateQuote({
    ...q,
    bid: '1.15900',
    ask: '1.15910',
    edaReceiveSequence: 'p8-fire',
    freshness: 'FRESH',
    quality: 'OK',
    status: 'TRADEABLE',
  });
  assert.equal(prot.getOwned(USER, sl.protectionId).status, 'FILLED');
  resetForexDealingForTests();
}

{
  const { liq, positions, acc, orders } = harness();
  await acc.credit({ accountId: USER, amount: '200', idempotencyKey: 'DEPOSIT:p8l', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'p8-liq', volume: '1.00', price: '1.16622' }));
  const rec = await liq.evaluateAccount(USER);
  assert.ok(rec);
  assert.ok(['LIQUIDATED', 'PARTIALLY_LIQUIDATED', 'FAILED', 'EXECUTING'].includes(rec.status));
  setForexAccountLiquidationLock(USER, true);
  const blocked = await orders.place(USER, {
    clientOrderId: 'p8-lock-inc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
  });
  assert.equal(blocked.status, 'REJECTED');
  assert.ok(blocked.failureReason === 'ACCOUNT_LIQUIDATION_LOCK' || blocked.failureReason === 'LIQUIDATION_ONLY' || blocked.failureReason === 'FOREX_HALTED' || blocked.failureReason === 'ACCOUNT_RESTRICTED');
  setForexAccountLiquidationLock(USER, false);
}

{
  const { orders, acc } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8c', type: 'DEPOSIT' });
  setForexGlobalLimits({ maxOrderVolume: '0.10', maxPositionVolume: '0.10' });
  const a = orders.place(USER, { clientOrderId: 'p8-c1', symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' });
  const b = orders.place(USER, { clientOrderId: 'p8-c2', symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' });
  const [ra, rb] = await Promise.all([a, b]);
  const filled = [ra, rb].filter((o) => o.status === 'FILLED');
  const rejected = [ra, rb].filter((o) => o.status === 'REJECTED');
  assert.equal(filled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.failureReason === 'MAX_POSITION_VOLUME' || rejected[0]?.failureReason === 'MAX_ORDER_VOLUME' || rejected[0]?.failureReason === 'MAX_ACCOUNT_EXPOSURE');
  resetForexRiskLimitsForTests();
}

{
  const warning = deriveAccountRiskState({
    accountingAvailable: true,
    equity: '160',
    positions: [{ status: 'OPEN', volume: '1', exposure: '1000', initialMargin: '100', maintenanceMargin: '50' } as ForexPositionRecord],
    liquidationLocked: false,
    emergencyHalt: false,
    tradingDisabled: false,
    killSwitch: false,
    accountEnabled: true,
  });
  assert.ok(warning.state === 'WARNING' || warning.state === 'RESTRICTED' || warning.state === 'NORMAL');
  const halt = deriveAccountRiskState({
    accountingAvailable: true,
    equity: '100000',
    positions: [],
    liquidationLocked: false,
    emergencyHalt: true,
    tradingDisabled: false,
    killSwitch: false,
    accountEnabled: true,
  });
  assert.equal(halt.state, 'HALTED');
  const liqOnly = deriveAccountRiskState({
    accountingAvailable: true,
    equity: '10',
    positions: [{ status: 'OPEN', volume: '1', exposure: '1000', initialMargin: '1000', maintenanceMargin: '500' } as ForexPositionRecord],
    liquidationLocked: false,
    emergencyHalt: false,
    tradingDisabled: false,
    killSwitch: false,
    accountEnabled: true,
  });
  assert.equal(liqOnly.state, 'LIQUIDATION_ONLY');
}

{
  const deal = evaluateDealingControls({
    snapshot: { ...getForexDealingSnapshot(USER, 'EURUSD'), emergencyHalt: true, emergencyAllowRiskReduction: true },
    side: 'sell',
    reducing: true,
  });
  assert.equal(deal.ok, true);
  setForexSymbolDealing('EURUSD', { enabled: false, riskReductionEnabled: false });
  const sym = evaluateDealingControls({ snapshot: getForexDealingSnapshot(USER, 'EURUSD'), side: 'buy', reducing: false });
  assert.equal(sym.ok, false);
  assert.equal(sym.ok === false && sym.reason, 'INSTRUMENT_HALTED');
  resetForexDealingForTests();
}

{
  const { risk, acc, positions } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8r', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'p8-rec', volume: '0.10', price: '1.16622' }));
  const rec = risk.syncState(USER);
  assert.ok(rec.state);
  assert.equal(risk.recover().find((r) => r.accountId === USER)?.accountId, USER);
}

{
  resetForexAccountPoliciesForTests();
  resetForexDealingForTests();
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  resetForexRiskServiceForTests(positions, pricing);
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
  await registerForexRiskRoutes(app);
  await app.ready();
  uid = null;
  assert.equal((await app.inject({ method: 'GET', url: '/risk/status' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/exposure' })).statusCode, 401);
  uid = USER;
  const st = await app.inject({ method: 'GET', url: '/risk/status' });
  assert.equal(st.statusCode, 200);
  assert.equal(st.json().data.source, 'SIMULATED');
  assert.equal(st.json().data.executionMode, 'MOCK');
  uid = USER_B;
  const other = await app.inject({ method: 'GET', url: '/exposure' });
  assert.equal(other.statusCode, 200);
  assert.equal(other.json().data.accountGross, '0');
  await app.close();
  assert.equal(isForexAccountPrivateChannel('fx.restriction'), true);
  class FakeSock {
    readyState = 1;
    sent: string[] = [];
    send(s: string) {
      this.sent.push(s);
    }
  }
  const a = new FakeSock();
  const b = new FakeSock();
  const idA = forexWsHub.register(a as unknown as import('ws').WebSocket, USER, USER);
  const idB = forexWsHub.register(b as unknown as import('ws').WebSocket, USER_B, USER_B);
  assert.equal(forexWsHub.subscribe(idA, 'fx.restriction'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.exposure'), true);
  forexWsHub.publishPrivate(USER, 'fx.restriction', { source: 'SIMULATED', secret: 'a-only' });
  assert.ok(a.sent.some((s) => s.includes('a-only')));
  assert.equal(b.sent.some((s) => s.includes('a-only')), false);
}

{
  setForexAccountPolicy(USER, { killSwitch: true });
  const { orders, acc } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p8k', type: 'DEPOSIT' });
  setForexAccountPolicy(USER, { killSwitch: true });
  const killed = await orders.place(USER, {
    clientOrderId: 'p8-kill',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
  });
  assert.equal(killed.status, 'REJECTED');
  assert.ok(killed.failureReason === 'FOREX_HALTED' || killed.failureReason === 'RISK_REJECTED');
}

{
  const files = [
    'services/forex/risk/pretrade.ts',
    'services/forex/risk/service.ts',
    'services/forex/risk/policy.ts',
    'services/forex/risk/dealing.ts',
    'routes/forex-risk.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('Math.random'), false);
  }
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('forex-phase8.test: ok');
