import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexCustomerOrderRoutes } from '../../routes/forex-orders.fastify.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues, asMock } from './execution/venues.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { ForexOrderError, publicForexOrder } from './orders/models.js';
import type { ForexOrderRequest } from './orders/request.js';
import { clientExecIdForOrder } from './orders/request.js';
import { ForexOrderService, resetForexOrderServiceForTests } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { assertOrderTransition, canOrderTransition } from './orders/states.js';
import { forexWsHub } from './ws/hub.js';
import type { ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook(pricing = resetForexPricingServiceForTests(), now = new Date()) {
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
  return pricing;
}

function req(overrides: Partial<ForexOrderRequest> = {}): ForexOrderRequest {
  return {
    clientOrderId: overrides.clientOrderId ?? `ord-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '1.00',
    maxSlippage: '0.01000',
    maxDeviation: '0.01000',
    ...overrides,
  };
}

function svc() {
  const pricing = seedBook();
  const venues = createMockExecutionVenues();
  const exec = new ForexExecutionService(pricing, venues, new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false);
  return { pricing, venues, exec, orders };
}

const USER = 'user-a';
const USER_B = 'user-b';

// 1 valid market
{
  const { orders } = svc();
  const o = await orders.place(USER, req({ clientOrderId: 'ok-mkt' }));
  assert.equal(o.status, 'FILLED');
  assert.equal(o.source, 'SIMULATED');
  assert.equal(o.executionMode, 'MOCK');
  assert.equal(o.clientExecId, clientExecIdForOrder(o.orderId));
  assert.ok(o.executionId);
  assert.equal(o.remainingVolume, '0');
}

// 2-7 invalid / unsupported
{
  const { orders } = svc();
  const badSym = await orders.place(USER, req({ clientOrderId: 'bad-sym', symbol: 'BTCUSDT' }));
  assert.equal(badSym.status, 'REJECTED');
  assert.equal(badSym.failureReason, 'UNKNOWN_INSTRUMENT');
  const badSide = await orders.place(USER, req({ clientOrderId: 'bad-side', side: 'hold' as 'buy' }));
  assert.equal(badSide.failureReason, 'INVALID_SIDE');
  const badVol = await orders.place(USER, req({ clientOrderId: 'bad-vol', volume: '0' }));
  assert.equal(badVol.failureReason, 'INVALID_VOLUME');
  const badStep = await orders.place(USER, req({ clientOrderId: 'bad-step', volume: '0.015' }));
  assert.equal(badStep.failureReason, 'INVALID_VOLUME_STEP');
  const unsup = await orders.place(USER, req({ clientOrderId: 'bad-lim', orderType: 'limit', requestedPrice: '1.16622' }));
  assert.equal(unsup.failureReason, 'UNSUPPORTED_ORDER_TYPE');
  assert.equal(unsup.executionId, null);
  const stop = await orders.place(USER, req({ clientOrderId: 'bad-stop', orderType: 'stop' }));
  assert.equal(stop.failureReason, 'UNSUPPORTED_ORDER_TYPE');
  const badCid = await orders.place(USER, req({ clientOrderId: 'bad id!' }));
  assert.equal(badCid.failureReason, 'INVALID_CLIENT_ORDER_ID');
}

// 8-10 idempotency + concurrent
{
  const { orders, exec } = svc();
  const first = await orders.place(USER, req({ clientOrderId: 'idem-1', volume: '1.00' }));
  const second = await orders.place(USER, req({ clientOrderId: 'idem-1', volume: '1.00' }));
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.clientExecId, second.clientExecId);
  assert.equal(first.executionId, second.executionId);
  assert.equal(first.fillIds.length, second.fillIds.length);
  let conflict = false;
  try {
    await orders.place(USER, req({ clientOrderId: 'idem-1', volume: '2.00' }));
  } catch (e) {
    conflict = e instanceof ForexOrderError && e.reason === 'IDEMPOTENCY_CONFLICT';
  }
  assert.equal(conflict, true);
  const otherUser = await orders.place(USER_B, req({ clientOrderId: 'idem-1', volume: '1.00' }));
  assert.notEqual(otherUser.orderId, first.orderId);

  const { orders: cOrders, exec: cExec } = svc();
  const [a, b] = await Promise.all([
    cOrders.place(USER, req({ clientOrderId: 'conc-1', volume: '1.00' })),
    cOrders.place(USER, req({ clientOrderId: 'conc-1', volume: '1.00' })),
  ]);
  assert.equal(a.orderId, b.orderId);
  assert.equal(a.executionId, b.executionId);
  assert.equal(cExec.get(a.clientExecId)?.fills.length, a.fillIds.length);
  void exec;
}

// 11-15 execution outcomes
{
  const { orders } = svc();
  const acc = await orders.place(USER, req({ clientOrderId: 'exec-ok' }));
  assert.equal(acc.status, 'FILLED');

  const { orders: rej, venues } = svc();
  asMock(venues.get('MOCK-A'))?.setForceReject(true);
  asMock(venues.get('MOCK-B'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  const rejected = await rej.place(USER, req({ clientOrderId: 'exec-rej' }));
  assert.equal(rejected.status, 'REJECTED');
  assert.ok(rejected.executionId);

  const { orders: fo, venues: vf } = svc();
  asMock(vf.get('MOCK-A'))?.setForceReject(true);
  asMock(vf.get('MOCK-C'))?.setForceReject(true);
  const failover = await fo.place(USER, req({ clientOrderId: 'exec-fo' }));
  assert.equal(failover.status, 'FILLED');

  const { orders: to, venues: vt, pricing } = svc();
  asMock(vt.get('MOCK-A'))?.setHangMs(4000);
  asMock(vt.get('MOCK-B'))?.setForceReject(true);
  asMock(vt.get('MOCK-C'))?.setForceReject(true);
  pricing.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  pricing.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const timed = await to.place(USER, req({ clientOrderId: 'exec-to' }));
  assert.equal(timed.status, 'FAILED');
  assert.equal(timed.failureReason, 'VENUE_TIMEOUT');

  const { orders: mal, venues: vm, pricing: pm } = svc();
  asMock(vm.get('MOCK-A'))?.setMalformed(true);
  asMock(vm.get('MOCK-B'))?.setForceReject(true);
  asMock(vm.get('MOCK-C'))?.setForceReject(true);
  pm.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  pm.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const failed = await mal.place(USER, req({ clientOrderId: 'exec-mal' }));
  assert.ok(failed.status === 'FAILED' || failed.status === 'REJECTED');
}

// 16-20 fills
{
  const { orders, exec } = svc();
  const full = await orders.place(USER, req({ clientOrderId: 'fill-full' }));
  assert.equal(full.status, 'FILLED');
  assert.ok(full.fillIds.length >= 1);
  const execRec = exec.get(full.clientExecId)!;
  assert.equal(execRec.fills.length, full.fillIds.length);

  const { orders: pexec, venues, exec: pEx } = svc();
  asMock(venues.get('MOCK-A'))?.setFillPlan(['0.40', '0.60']);
  asMock(venues.get('MOCK-B'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  const multi = await pexec.place(USER, req({ clientOrderId: 'fill-multi', volume: '1.00' }));
  assert.equal(multi.status, 'FILLED');
  assert.ok(multi.fillIds.length >= 2);
  assert.equal(multi.remainingVolume, '0');

  const { orders: ov, venues: vo } = svc();
  asMock(vo.get('MOCK-A'))?.setFillPlan(['2.00']);
  asMock(vo.get('MOCK-B'))?.setForceReject(true);
  asMock(vo.get('MOCK-C'))?.setForceReject(true);
  const over = await ov.place(USER, req({ clientOrderId: 'fill-over', volume: '1.00' }));
  assert.equal(over.status, 'FAILED');
  assert.equal(over.failureReason, 'OVERFILL');

  const again = pEx.get(multi.clientExecId)!;
  pexec.recoverOpen();
  const afterRecover = await pexec.getOwned(USER, multi.orderId);
  assert.equal(afterRecover.fillIds.length, again.fills.length);
}

// 21-23 state machine
{
  assert.equal(canOrderTransition('NEW', 'VALIDATING'), true);
  assert.equal(canOrderTransition('VALIDATING', 'ROUTING'), true);
  assert.equal(canOrderTransition('FILLED', 'NEW'), false);
  let threw = false;
  try {
    assertOrderTransition('FILLED', 'SUBMITTED');
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
}

// 24-26 cancel
{
  const { orders, venues } = svc();
  asMock(venues.get('MOCK-A'))?.setFillPlan(['0.40']);
  asMock(venues.get('MOCK-A'))?.setRejectAfterAccepts(1);
  asMock(venues.get('MOCK-B'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  const leftover = await orders.place(USER, req({ clientOrderId: 'cx-partial', volume: '1.00' }));
  assert.equal(leftover.status, 'PARTIALLY_FILLED');
  const cancelled = await orders.cancel(USER, leftover.orderId);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.ok(cancelled.events.some((e) => e.eventType === 'ORDER_CANCELLED'));

  const { orders: filledOrders } = svc();
  const filled = await filledOrders.place(USER, req({ clientOrderId: 'cx-filled' }));
  assert.equal(filled.status, 'FILLED');
  let filledCancel = false;
  try {
    await filledOrders.cancel(USER, filled.orderId);
  } catch (e) {
    filledCancel = e instanceof ForexOrderError && e.reason === 'CANCEL_FILLED_REJECTED';
  }
  assert.equal(filledCancel, true);

  const { orders: rejO, venues: vr } = svc();
  asMock(vr.get('MOCK-A'))?.setForceReject(true);
  asMock(vr.get('MOCK-B'))?.setForceReject(true);
  asMock(vr.get('MOCK-C'))?.setForceReject(true);
  const rej = await rejO.place(USER, req({ clientOrderId: 'cx-rej' }));
  assert.equal(rej.status, 'REJECTED');
  let unsup = false;
  try {
    await rejO.cancel(USER, rej.orderId);
  } catch (e) {
    unsup = e instanceof ForexOrderError && e.reason === 'CANCEL_NOT_SUPPORTED';
  }
  assert.equal(unsup, true);
}

// 27-28 recovery
{
  const { orders, exec, store: _s } = Object.assign(svc(), { store: null as unknown });
  void _s;
  const first = await orders.place(USER, req({ clientOrderId: 'rec-1', volume: '1.00' }));
  const store2 = new ForexOrderStore();
  store2.hydrate(orders.store.snapshot());
  const execStore2 = new ForexExecutionStore();
  execStore2.hydrate(exec.store.snapshot());
  const pricing2 = seedBook();
  const exec2 = new ForexExecutionService(pricing2, createMockExecutionVenues(), execStore2, false);
  const orders2 = new ForexOrderService(exec2, store2, false);
  const replay = await orders2.place(USER, req({ clientOrderId: 'rec-1', volume: '1.00' }));
  assert.equal(replay.orderId, first.orderId);
  assert.equal(replay.clientExecId, first.clientExecId);
  assert.equal(replay.executionId, first.executionId);
  assert.equal(replay.fillIds.length, first.fillIds.length);
  const open = orders2.recoverOpen();
  assert.ok(Array.isArray(open));
}

// 29-32 HTTP API
{
  const pricing = seedBook();
  const venues = createMockExecutionVenues();
  const exec = new ForexExecutionService(pricing, venues, new ForexExecutionStore(), false);
  resetForexOrderServiceForTests(exec);
  const app = Fastify();
  let uid = USER;
  app.decorate('authenticate', async (request: { user?: { id: string; role: string; sessionId: string } }) => {
    request.user = { id: uid, role: 'user', sessionId: 's' };
  });
  await registerForexCustomerOrderRoutes(app);
  await app.ready();

  const created = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { clientOrderId: 'http-1', symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '1.00', maxSlippage: '0.01', maxDeviation: '0.01' },
  });
  assert.equal(created.statusCode, 200);
  const createdBody = created.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.source, 'SIMULATED');
  assert.equal(createdBody.data.executionMode, 'MOCK');
  const orderId = createdBody.data.order.orderId as string;
  assert.equal(createdBody.data.order.status, 'FILLED');

  const listed = await app.inject({ method: 'GET', url: '/orders' });
  assert.equal(listed.statusCode, 200);
  assert.ok(listed.json().data.orders.some((o: { orderId: string }) => o.orderId === orderId));

  const detail = await app.inject({ method: 'GET', url: `/orders/${orderId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.order.orderId, orderId);

  const cancelFilled = await app.inject({ method: 'POST', url: `/orders/${orderId}/cancel` });
  assert.equal(cancelFilled.statusCode, 409);
  assert.equal(cancelFilled.json().error.code, 'CANCEL_FILLED_REJECTED');

  uid = USER_B;
  const leak = await app.inject({ method: 'GET', url: `/orders/${orderId}` });
  assert.equal(leak.statusCode, 404);
  await app.close();
}

// 33-37 websocket isolation
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
  assert.equal(forexWsHub.subscribe(idA, 'fx.order'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.order'), true);
  forexWsHub.publishOrder(USER, 'fx.order.created', { source: 'SIMULATED', orderId: 'only-a' });
  assert.ok(a.sent.some((s) => s.includes('only-a')));
  assert.equal(b.sent.some((s) => s.includes('only-a')), false);
  const anon = new FakeSock();
  const idN = forexWsHub.register(anon as unknown as import('ws').WebSocket);
  assert.equal(forexWsHub.subscribe(idN, 'fx.order'), false);
  forexWsHub.unregister(idA);
  forexWsHub.unregister(idB);
  forexWsHub.unregister(idN);
}

// 38-41 isolation
{
  const files = [
    'services/forex/orders/service.ts',
    'services/forex/orders/persist.ts',
    'routes/forex-orders.fastify.ts',
    'routes/forex.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('/api/v1/spot/ws'), false);
  }
  const dto = publicForexOrder({
    orderId: 'x',
    clientOrderId: 'c',
    clientExecId: 'FX-x',
    accountId: USER,
    fingerprint: 'f',
    request: req({ clientOrderId: 'c' }),
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    requestedVolume: '1.00',
    filledVolume: '0',
    remainingVolume: '1.00',
    requestedPrice: null,
    maxSlippage: null,
    maxDeviation: null,
    status: 'NEW',
    failureReason: null,
    executionId: null,
    fillIds: [],
    source: 'SIMULATED',
    executionMode: 'MOCK',
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal('accountId' in dto, false);
}

console.log('forex-phase4.test: ok');
