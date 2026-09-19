import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexLiquidationRoutes } from '../../routes/forex-liquidation.fastify.js';
import { registerForexProtectionRoutes } from '../../routes/forex-protection.fastify.js';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { calculateLiquidationEligibility } from './liquidation/eligibility.js';
import { resetForexLiquidationLocksForTests, setForexAccountLiquidationLock } from './liquidation/lock.js';
import { rankLiquidationCandidates } from './liquidation/priority.js';
import { resetForexLiquidationServiceForTests } from './liquidation/service.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import type { ForexPositionFillInput, ForexPositionRecord } from './positions/models.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { ForexProtectionError } from './protection/models.js';
import { resetForexProtectionServiceForTests } from './protection/service.js';
import { canProtectionTransition } from './protection/states.js';
import { isProtectionTriggered, quoteKey, quoteUsableForTrigger } from './protection/trigger.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexAccountPoliciesForTests, setForexAccountPolicy } from './risk/engine.js';
import { forexWsHub } from './ws/hub.js';
import { isForexAccountPrivateChannel, isReservedPrivateForexChannel } from './ws/protocol.js';
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
  resetForexSessionExceptionsForTests();
  setForexSessionNowForTests(OPEN_SESSION_CLOCK);
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const prot = resetForexProtectionServiceForTests(positions, orders, pricing);
  const liq = resetForexLiquidationServiceForTests(positions, orders, acc);
  positions.attachProtection(prot);
  // Do not attach liquidation to fill lifecycle here: applyFill would race evaluateAccount.
  return { pricing, positions, orders, acc, prot, liq };
}

function quotePatch(base: ForexQuoteDto, patch: Partial<ForexQuoteDto>): ForexQuoteDto {
  return { ...base, ...patch };
}

{
  assert.equal(canProtectionTransition('ACTIVE', 'TRIGGERING'), true);
  assert.equal(canProtectionTransition('ACTIVE', 'FILLED'), false);
  assert.equal(canProtectionTransition('FILLED', 'ACTIVE'), false);
}

{
  const { prot, positions, acc, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p7', type: 'DEPOSIT' });
  const opened = await positions.applyFill(fill({ fillId: 'p7-open', volume: '1.00', price: '1.16622' }));
  assert.ok(opened);
  const sl = await prot.create(USER, {
    clientProtectionId: 'sl-long',
    positionId: opened.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  assert.equal(sl.status, 'ACTIVE');
  assert.equal(sl.type, 'STOP_LOSS');
  assert.equal(sl.source, 'SIMULATED');

  const replay = await prot.create(USER, {
    clientProtectionId: 'sl-long',
    positionId: opened.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  assert.equal(replay.protectionId, sl.protectionId);

  await assert.rejects(
    () =>
      prot.create(USER, {
        clientProtectionId: 'sl-long',
        positionId: opened.positionId,
        type: 'STOP_LOSS',
        triggerPrice: '1.15000',
      }),
    (e: unknown) => e instanceof ForexProtectionError && e.reason === 'IDEMPOTENCY_CONFLICT'
  );

  await assert.rejects(
    () =>
      prot.create(USER, {
        clientProtectionId: 'sl-bad-dir',
        positionId: opened.positionId,
        type: 'STOP_LOSS',
        triggerPrice: '1.18000',
      }),
    (e: unknown) => e instanceof ForexProtectionError && e.reason === 'INVALID_TRIGGER_DIRECTION'
  );

  const tp = await prot.create(USER, {
    clientProtectionId: 'tp-long',
    positionId: opened.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.17000',
  });
  assert.equal(tp.type, 'TAKE_PROFIT');

  await assert.rejects(
    () =>
      prot.create(USER, {
        clientProtectionId: 'sl-dup',
        positionId: opened.positionId,
        type: 'STOP_LOSS',
        triggerPrice: '1.16100',
      }),
    (e: unknown) => e instanceof ForexProtectionError && e.reason === 'DUPLICATE_PROTECTION'
  );

  const cancelled = await prot.cancel(USER, tp.protectionId);
  assert.equal(cancelled.status, 'CANCELLED');

  const q = pricing.getQuote('EURUSD')!;
  const stale = quotePatch(q, { freshness: 'STALE', quality: 'STALE', edaReceiveSequence: 'stale-1' });
  assert.equal(quoteUsableForTrigger(stale), false);
  await prot.evaluateQuote(stale);
  assert.equal(prot.getOwned(USER, sl.protectionId).status, 'ACTIVE');

  const crossed = quotePatch(q, { bid: '1.17000', ask: '1.16000', quality: 'CROSSED', status: 'UNAVAILABLE', edaReceiveSequence: 'x-1' });
  assert.equal(quoteUsableForTrigger(crossed), false);

  const fire = quotePatch(q, { bid: '1.15900', ask: '1.15910', edaReceiveSequence: 'fire-1', freshness: 'FRESH', quality: 'OK', status: 'TRADEABLE' });
  assert.equal(isProtectionTriggered(sl, fire.bid), true);
  await prot.evaluateQuote(fire);
  const after = prot.getOwned(USER, sl.protectionId);
  assert.equal(after.status, 'FILLED');
  assert.ok(after.orderId);
  assert.equal(positions.listOwned(USER, true).length, 0);

  await prot.evaluateQuote(fire);
  assert.equal(prot.getOwned(USER, sl.protectionId).status, 'FILLED');
  assert.equal(quoteKey(fire), quoteKey(fire));
}

{
  const { prot, positions, acc, pricing } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:p7s', type: 'DEPOSIT' });
  const opened = await positions.applyFill(fill({ fillId: 'p7-short', side: 'sell', volume: '1.00', price: '1.16622' }));
  const sl = await prot.create(USER, {
    clientProtectionId: 'sl-short',
    positionId: opened!.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.17000',
  });
  const tp = await prot.create(USER, {
    clientProtectionId: 'tp-short',
    positionId: opened!.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.16000',
  });
  assert.equal(sl.status, 'ACTIVE');
  const q = pricing.getQuote('EURUSD')!;
  await prot.evaluateQuote(quotePatch(q, { bid: '1.17010', ask: '1.17020', edaReceiveSequence: 'ss-1', freshness: 'FRESH', quality: 'OK', status: 'TRADEABLE' }));
  assert.equal(prot.getOwned(USER, sl.protectionId).status, 'FILLED');
  assert.equal(prot.getOwned(USER, tp.protectionId).status, 'CANCELLED');
}

{
  const ranked = rankLiquidationCandidates([
    { positionId: 'b', initialMargin: '10', exposure: '100', status: 'OPEN', volume: '1' } as ForexPositionRecord,
    { positionId: 'a', initialMargin: '50', exposure: '10', status: 'OPEN', volume: '1' } as ForexPositionRecord,
    { positionId: 'c', initialMargin: '50', exposure: '80', status: 'OPEN', volume: '1' } as ForexPositionRecord,
  ]);
  assert.equal(ranked[0]?.positionId, 'c');
  assert.equal(ranked[1]?.positionId, 'a');
  assert.equal(ranked[2]?.positionId, 'b');

  const none = calculateLiquidationEligibility({ positions: [], equity: '100', accountingAvailable: true });
  assert.equal(none.eligible, false);
  const closed = calculateLiquidationEligibility({
    positions: [{ status: 'OPEN', volume: '1', initialMargin: '1000', maintenanceMargin: '500' } as ForexPositionRecord],
    accountingAvailable: false,
  });
  assert.equal(closed.eligible, false);
  assert.equal(closed.reason, 'ACCOUNTING_UNAVAILABLE');
  const breach = calculateLiquidationEligibility({
    positions: [{ status: 'OPEN', volume: '1', initialMargin: '1000', maintenanceMargin: '500' } as ForexPositionRecord],
    equity: '100',
    accountingAvailable: true,
  });
  assert.equal(breach.eligible, true);
}

{
  const { liq, positions, acc, orders } = harness();
  await acc.credit({ accountId: USER, amount: '200', idempotencyKey: 'DEPOSIT:liq', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'liq-open', volume: '1.00', price: '1.16622' }));
  const elig = liq.eligibility(USER);
  assert.equal(elig.eligible, true);
  const first = await liq.evaluateAccount(USER);
  assert.ok(first);
  assert.ok(first.status === 'LIQUIDATED' || first.status === 'PARTIALLY_LIQUIDATED' || first.status === 'FAILED' || first.status === 'EXECUTING');
  if (first.status === 'LIQUIDATED') {
    assert.equal(positions.listOwned(USER, true).length, 0);
    assert.ok(first.orderIds.length >= 1);
  }
  const dup = await liq.evaluateAccount(USER);
  if (first.status === 'EXECUTING' || first.status === 'PARTIALLY_LIQUIDATED') {
    assert.equal(dup?.liquidationId, first.liquidationId);
  }

  resetForexLiquidationLocksForTests();
  setForexAccountLiquidationLock(USER, true);
  const blocked = await orders.place(USER, {
    clientOrderId: 'locked-new',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
    maxSlippage: '0.01',
    maxDeviation: '0.01',
  });
  assert.equal(blocked.status, 'REJECTED');
  assert.equal(blocked.failureReason, 'ACCOUNT_LIQUIDATION_LOCK');
  setForexAccountLiquidationLock(USER, false);
}

{
  const { prot, positions, acc } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:rec', type: 'DEPOSIT' });
  const opened = await positions.applyFill(fill({ fillId: 'rec-open', volume: '1.00', price: '1.16622' }));
  const p = await prot.create(USER, {
    clientProtectionId: 'rec-sl',
    positionId: opened!.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  p.status = 'EXECUTING';
  const recovered = prot.recover();
  assert.equal(recovered.find((x) => x.protectionId === p.protectionId)?.status, 'FAILED');
  assert.equal(recovered.find((x) => x.protectionId === p.protectionId)?.failureReason, 'RECOVERY_FAIL_CLOSED');
  assert.equal(prot.reconcile(USER).ok, true);
}

{
  resetForexAccountPoliciesForTests();
  resetForexLiquidationLocksForTests();
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions);
  resetForexAccountingServiceForTests(positions, pricing);
  const prot = resetForexProtectionServiceForTests(positions, orders, pricing);
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
  const { resetForexPositionServiceForTests } = await import('./positions/service.js');
  const livePos = resetForexPositionServiceForTests(pricing);
  livePos.attachProtection(prot);
  await registerForexProtectionRoutes(app);
  await registerForexLiquidationRoutes(app);
  await app.ready();
  const unauthUid = uid;
  uid = null;
  const unauth = await app.inject({ method: 'GET', url: '/protections' });
  assert.equal(unauth.statusCode, 401);
  const unauthLiq = await app.inject({ method: 'GET', url: '/liquidation' });
  assert.equal(unauthLiq.statusCode, 401);
  uid = unauthUid;
  const list = await app.inject({ method: 'GET', url: '/protections' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.source, 'SIMULATED');
  uid = USER_B;
  const leak = await app.inject({ method: 'GET', url: `/protections/${'00000000-0000-4000-8000-000000000001'}` });
  assert.equal(leak.statusCode, 404);
  const leakLiq = await app.inject({ method: 'GET', url: '/liquidation/00000000-0000-4000-8000-000000000001' });
  assert.equal(leakLiq.statusCode, 404);
  await app.close();

  assert.equal(isForexAccountPrivateChannel('fx.protection'), true);
  assert.equal(isForexAccountPrivateChannel('fx.liquidation'), true);
  assert.equal(isReservedPrivateForexChannel('fx.copy.x'), true);
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
  assert.equal(forexWsHub.subscribe(idA, 'fx.protection'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.liquidation'), true);
  forexWsHub.publishPrivate(USER, 'fx.protection', { source: 'SIMULATED', secret: 'a-only' });
  assert.ok(a.sent.some((s) => s.includes('a-only')));
  assert.equal(b.sent.some((s) => s.includes('a-only')), false);
}

{
  const files = [
    'services/forex/protection/service.ts',
    'services/forex/liquidation/service.ts',
    'routes/forex-protection.fastify.ts',
    'routes/forex-liquidation.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('Math.random'), false);
  }
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('forex-phase7.test: ok');
