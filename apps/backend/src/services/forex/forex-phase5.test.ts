import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexPositionRoutes } from '../../routes/forex-positions.fastify.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { effectiveLeverage } from './margin/leverage.js';
import { classifyMarginLevel, maintenanceFromInitial, notionalValue, requiredMargin } from './margin/engine.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { applyNettingFill, replayNetting } from './positions/netting.js';
import type { ForexPositionFillInput } from './positions/models.js';
import { ForexPositionService, resetForexPositionServiceForTests } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import {
  evaluateAccountRisk,
  resetForexAccountPoliciesForTests,
  setForexAccountPolicy,
} from './risk/engine.js';
import { forexWsHub } from './ws/hub.js';
import type { ProviderRawQuote } from './types.js';

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
  return {
    accountId: USER,
    symbol: 'EURUSD',
    side: 'buy',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function pos() {
  resetForexAccountPoliciesForTests();
  const pricing = seedBook();
  return new ForexPositionService(new ForexPositionStore(), pricing, false);
}

// 1-10 positions
{
  const s = pos();
  const a = await s.applyFill(fill({ fillId: 'f1', volume: '1.00', price: '1.10000' }));
  assert.equal(a?.side, 'long');
  assert.equal(fxDecimal(a!.volume).eq('1.00'), true);
  assert.equal(a?.status, 'OPEN');
  assert.equal(a?.mode, 'NETTING');

  const b = await s.applyFill(fill({ fillId: 'f2', volume: '0.50', price: '1.20000' }));
  assert.equal(fxDecimal(b!.volume).eq('1.50'), true);
  const expectAvg = fxDecimal('1.00').times('1.10000').plus(fxDecimal('0.50').times('1.20000')).div('1.5');
  assert.equal(b?.entryPrice, expectAvg.toFixed());
  assert.equal(b?.averageEntryPrice, b?.entryPrice);

  const c = await s.applyFill(fill({ fillId: 'f3', side: 'sell', volume: '0.50', price: '1.15000' }));
  assert.equal(c?.side, 'long');
  assert.equal(fxDecimal(c!.volume).eq('1.00'), true);
  assert.equal(c?.entryPrice, expectAvg.toFixed());

  const d = await s.applyFill(fill({ fillId: 'f4', side: 'sell', volume: '1', price: '1.16000' }));
  assert.equal(d?.status, 'CLOSED');
  assert.equal(d?.volume, '0');

  const s2 = pos();
  await s2.applyFill(fill({ fillId: 'r1', volume: '1.00', price: '1.10000' }));
  const rev = await s2.applyFill(fill({ fillId: 'r2', side: 'sell', volume: '1.50', price: '1.20000' }));
  assert.equal(rev?.side, 'short');
  assert.equal(fxDecimal(rev!.volume).eq('0.50'), true);
  assert.equal(fxDecimal(rev!.entryPrice).eq('1.20000'), true);

  const dup = await s2.applyFill(fill({ fillId: 'r2', side: 'sell', volume: '1.50', price: '1.20000' }));
  assert.equal(fxDecimal(dup!.volume).eq('0.50'), true);

  const s3 = pos();
  const [x, y] = await Promise.all([
    s3.applyFill(fill({ fillId: 'c1', volume: '1.00', price: '1.10000' })),
    s3.applyFill(fill({ fillId: 'c2', volume: '1.00', price: '1.10000' })),
  ]);
  const open = s3.listOwned(USER, true)[0];
  assert.equal(fxDecimal(open!.volume).eq('2.00'), true);
  void x;
  void y;

  const store2 = new ForexPositionStore();
  store2.hydrate(s3.store.snapshot());
  const recovered = new ForexPositionService(store2, seedBook(), false);
  recovered.recoverOpen();
  assert.equal(fxDecimal(recovered.listOwned(USER, true)[0]!.volume).eq('2.00'), true);
  assert.equal(recovered.listOwned(USER, true).length, 1);
}

// 11-20 margin / leverage
{
  assert.equal(effectiveLeverage({ globalMax: '100', accountMax: '50', instrumentMax: '30' }), '30');
  const n = notionalValue('1.00', '100000', '1.16622');
  const byLev = requiredMargin(n, '50', '0');
  const byPct = requiredMargin(n, '100000', '2.00');
  assert.equal(fxDecimal(byLev).toFixed(), fxDecimal(n).div(50).toFixed());
  assert.equal(fxDecimal(byPct).toFixed(), fxDecimal(n).times('0.02').toFixed());
  const strict = requiredMargin(n, '50', '2.00');
  assert.ok(!fxDecimal(strict).lt(byLev));
  const maint = maintenanceFromInitial('1000', '0.50');
  assert.equal(maint, '500');
  assert.equal(classifyMarginLevel('200'), 'NORMAL');
  assert.equal(classifyMarginLevel('150'), 'WARNING');
  assert.equal(classifyMarginLevel('100'), 'MARGIN_CALL');
  assert.equal(classifyMarginLevel('50'), 'STOP_OUT_READY');

  const s = pos();
  const p = await s.applyFill(fill({ fillId: 'm1', volume: '1.00', price: '1.16622' }));
  assert.ok(p);
  assert.ok(fxDecimal(p.initialMargin).gt(0));
  assert.ok(fxDecimal(p.maintenanceMargin).gt(0));
  assert.ok(fxDecimal(p.maintenanceMargin).lt(p.initialMargin));
  const snap = s.accountSnapshot(USER);
  assert.equal(snap.source, 'SIMULATED');
  assert.equal(snap.valuationKind, 'CALCULATED');
  assert.ok(fxDecimal(snap.usedMargin).gt(0));
  assert.ok(fxDecimal(snap.freeMargin).lt(snap.equityReference));
  assert.ok(snap.marginLevel);
}

// 21-28 risk
{
  resetForexAccountPoliciesForTests();
  const s = pos();
  await s.applyFill(fill({ fillId: 'k1', volume: '1.00', price: '1.16622' }));
  setForexAccountPolicy(USER, { maxPositionVolume: '1.00' });
  const previewBig = s.previewAfterFill(fill({ fillId: 'k2', volume: '1.50', price: '1.16622' }));
  const denied = evaluateAccountRisk({ accountId: USER, positions: previewBig, proposedVolume: '1.50', proposedSymbol: 'EURUSD' });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'MAX_POSITION_VOLUME');

  resetForexAccountPoliciesForTests();
  setForexAccountPolicy(USER, { maxSymbolExposure: '1' });
  const expDeny = evaluateAccountRisk({ accountId: USER, positions: s.listOwned(USER, true), proposedSymbol: 'EURUSD' });
  assert.equal(expDeny.ok, false);
  assert.equal(expDeny.reason, 'MAX_SYMBOL_EXPOSURE');

  resetForexAccountPoliciesForTests();
  setForexAccountPolicy(USER, { maxTotalExposure: '1' });
  const tot = evaluateAccountRisk({ accountId: USER, positions: s.listOwned(USER, true) });
  assert.equal(tot.reason, 'MAX_TOTAL_EXPOSURE');

  resetForexAccountPoliciesForTests();
  setForexAccountPolicy(USER, { maxMarginUtilization: '0.0001', balanceReference: '100000' });
  const util = evaluateAccountRisk({ accountId: USER, positions: s.listOwned(USER, true) });
  assert.equal(util.reason, 'MAX_MARGIN_UTILIZATION');

  resetForexAccountPoliciesForTests();
  setForexAccountPolicy(USER, { maxOrderVolume: '0.50' });
  const ov = evaluateAccountRisk({ accountId: USER, positions: [], proposedVolume: '1.00', proposedSymbol: 'EURUSD' });
  assert.equal(ov.reason, 'MAX_ORDER_VOLUME');

  resetForexAccountPoliciesForTests();
  const pricing = seedBook();
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions);
  setForexAccountPolicy(USER, { maxOrderVolume: '0.50' });
  const rejected = await orders.place(USER, {
    clientOrderId: 'risk-rej',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '1.00',
    maxSlippage: '0.01',
    maxDeviation: '0.01',
  });
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.failureReason, 'RISK_REJECTED');
  assert.equal(positions.listOwned(USER, true).length, 0);

  resetForexAccountPoliciesForTests();
  const ok = await orders.place(USER, {
    clientOrderId: 'risk-ok',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '1.00',
    maxSlippage: '0.01',
    maxDeviation: '0.01',
  });
  assert.equal(ok.status, 'FILLED');
  assert.equal(fxDecimal(positions.listOwned(USER, true)[0]!.volume).eq('1.00'), true);

  const [p1, p2] = await Promise.all([
    evaluateAccountRisk({ accountId: USER, positions: positions.listOwned(USER, true) }),
    evaluateAccountRisk({ accountId: USER, positions: positions.listOwned(USER, true) }),
  ]);
  assert.equal(p1.ok, p2.ok);
}

// 29-30 reconciliation
{
  const s = pos();
  const p = await s.applyFill(fill({ fillId: 'rec1', volume: '1.00', price: '1.10000' }));
  assert.ok(p);
  assert.equal(s.reconcile(p).ok, true);
  p.volume = '9.00';
  const bad = s.reconcile(p);
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.reason, 'POSITION_RECONCILIATION_ERROR');
  assert.equal(p.volume, '9.00');

  const replay = replayNetting([{ fillId: 'a', side: 'buy', volume: '1.00', price: '1.1', timestamp: 't' }]);
  assert.equal(replay?.volume, '1');
  const net = applyNettingFill(null, { fillId: 'z', side: 'sell', volume: '0.25', price: '1.2', timestamp: 't' });
  assert.equal(net.after.side, 'short');
}

// 31-36 API
{
  resetForexAccountPoliciesForTests();
  const pricing = seedBook();
  const svc = resetForexPositionServiceForTests(pricing);
  await svc.applyFill(fill({ fillId: 'api1', volume: '1.00', price: '1.16622' }));
  const posId = svc.listOwned(USER, true)[0]!.positionId;
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
  await registerForexPositionRoutes(app);
  await app.ready();
  const list = await app.inject({ method: 'GET', url: '/positions' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.source, 'SIMULATED');
  assert.ok(list.json().data.positions.some((p: { positionId: string }) => p.positionId === posId));
  const det = await app.inject({ method: 'GET', url: `/positions/${posId}` });
  assert.equal(det.statusCode, 200);
  const mar = await app.inject({ method: 'GET', url: '/margin' });
  assert.equal(mar.statusCode, 200);
  assert.equal(mar.json().data.margin.valuationKind, 'CALCULATED');
  const risk = await app.inject({ method: 'GET', url: '/risk' });
  assert.equal(risk.statusCode, 200);
  uid = USER_B;
  const leak = await app.inject({ method: 'GET', url: `/positions/${posId}` });
  assert.equal(leak.statusCode, 404);
  uid = null;
  const unauth = await app.inject({ method: 'GET', url: '/positions' });
  assert.equal(unauth.statusCode, 401);
  await app.close();
}

// 37-41 websocket
{
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
  assert.equal(forexWsHub.subscribe(idA, 'fx.position'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.position'), true);
  assert.equal(forexWsHub.subscribe(idA, 'fx.margin'), true);
  assert.equal(forexWsHub.subscribe(idA, 'fx.risk'), true);
  forexWsHub.publishPrivate(USER, 'fx.position', { source: 'SIMULATED', only: 'a' });
  forexWsHub.publishPrivate(USER, 'fx.margin', { source: 'SIMULATED', m: 1 });
  forexWsHub.publishPrivate(USER, 'fx.risk', { source: 'SIMULATED', r: 1 });
  assert.ok(a.sent.some((s) => s.includes('"only":"a"')));
  assert.equal(b.sent.some((s) => s.includes('"only":"a"')), false);
  const anon = new FakeSock();
  assert.equal(forexWsHub.subscribe(forexWsHub.register(anon as unknown as import('ws').WebSocket), 'fx.position'), false);
}

// isolation
{
  const files = [
    'services/forex/positions/service.ts',
    'services/forex/positions/persist.ts',
    'services/forex/margin/engine.ts',
    'services/forex/risk/engine.ts',
    'routes/forex-positions.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('parseFloat'), false);
  }
}

console.log('forex-phase5.test: ok');
