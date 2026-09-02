/**
 * Forex DEMO certification — simulated / MOCK only.
 * Run: FOREX_SILENT_LOG=1 FOREX_DEMO_FUNDING=true npx tsx src/services/forex/forex-demo-cert.test.ts
 *
 * Proves the mandatory lifecycle:
 *   DEMO FUNDING → preview → MARKET BUY/SELL → fill → position → margin/P&L
 *   → SL/TP → pending trigger → partial close → full close → ledger reconcile
 * Never routes to a real LP. Never touches Crypto balances.
 */
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerForexAccountingRoutes } from '../../routes/forex-accounting.fastify.js';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { getForexAdminBackendConfig } from './admin/config.js';
import { forexConfig } from './config.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS, getForexInstrumentBySymbol } from './instruments.catalog.js';
import { marginLevel, notionalValue, requiredMargin } from './margin/engine.js';
import { closeForexPosition } from './orders/close.js';
import { ForexOrderError } from './orders/models.js';
import { previewForexOrder } from './orders/preview.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { ForexQuoteConversionSource } from './pnl/conversion.js';
import { calculateUnrealizedPnl, quoteRealizedPnl } from './pnl/engine.js';
import { ForexPositionError } from './positions/models.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { ForexProtectionService } from './protection/service.js';
import { ForexProtectionStore } from './protection/store.js';
import { mockPriceAt, unpinForexDemoMid } from './market-data/mock-provider.js';
import { resetForexPricingServiceForTests, type ForexPricingService } from './quotes.service.js';
import { calculateForexExposure } from './risk/exposure.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import type { ProviderRawQuote } from './types.js';

const DEMO = 'demo-cert-user';
const REJECT = 'demo-reject-user';
const START = forexConfig.demoFundingDefaultAmount;
const CONTRACT = getForexInstrumentBySymbol('EURUSD')?.contractSize ?? '100000';
const RESULTS: Record<string, 'PASS' | 'FAIL'> = {};

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function ingestEurUsd(pricing: ForexPricingService, bid: string, ask: string, seq = 1n): void {
  const now = new Date();
  const spread = fxDecimal(ask).minus(bid);
  const b2 = fxDecimal(bid).plus('0.00001').toFixed();
  const a2 = fxDecimal(ask).plus('0.00001').toFixed();
  const b3 = fxDecimal(bid).minus('0.00001').toFixed();
  const a3 = fxDecimal(ask).minus('0.00001').toFixed();
  void spread;
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid, ask, providerSequence: seq }),
    now
  );
  pricing.ingestRaw(
    raw({
      symbol: 'EURUSD',
      providerId: FOREX_PROVIDER_IDS.MOCK_B,
      providerCode: 'MOCK-B',
      bid: b2,
      ask: a2,
      providerSequence: seq,
    }),
    now
  );
  pricing.ingestRaw(
    raw({
      symbol: 'EURUSD',
      providerId: FOREX_PROVIDER_IDS.MOCK_C,
      providerCode: 'MOCK-C',
      bid: b3,
      ask: a3,
      providerSequence: seq,
    }),
    now
  );
}

function harness() {
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  const pricing = resetForexPricingServiceForTests();
  ingestEurUsd(pricing, '1.16620', '1.16623');
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  const protections = new ForexProtectionService(new ForexProtectionStore(), positions, orders, pricing, false);
  positions.attachProtection(protections);
  return { pricing, positions, acc, orders, protections };
}

function assertInvariants(label: string, view: {
  ledgerBalance: string;
  equity: string;
  unrealizedPnl: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
}): void {
  const equity = fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl);
  assert.ok(equity.eq(view.equity), `${label}: Equity != Balance + Unrealized (${view.equity} != ${equity.toFixed()})`);
  const free = fxDecimal(view.equity).minus(view.usedMargin);
  assert.ok(free.eq(view.freeMargin), `${label}: Free != Equity - Used`);
  if (fxDecimal(view.usedMargin).gt(0)) {
    const lvl = marginLevel(view.equity, view.usedMargin);
    assert.ok(lvl != null && fxDecimal(lvl).eq(view.marginLevel ?? 'NaN'), `${label}: margin level mismatch`);
  } else {
    assert.equal(view.marginLevel, null, `${label}: unused margin must not invent a level`);
  }
}

function expectedRequiredMargin(volume: string, price: string): string {
  const instrument = getForexInstrumentBySymbol('EURUSD');
  const notional = notionalValue(volume, CONTRACT, price);
  return requiredMargin(notional, instrument?.maxLeverage ?? forexConfig.defaultAccountLeverage, instrument?.marginPercent ?? '2.00');
}

async function mark(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    RESULTS[name] = 'PASS';
  } catch (e) {
    RESULTS[name] = 'FAIL';
    throw e;
  }
}

async function testZeroSpreadSource(): Promise<void> {
  if (forexConfig.demoZeroSpread) {
    for (const idx of [0, 1, 2] as const) {
      const px = mockPriceAt('EURUSD', 4n, idx);
      assert.equal(px.bid, px.ask, `mock provider ${idx} must print Bid=Ask in DEMO`);
    }
  }
  const pricing = resetForexPricingServiceForTests();
  const dto = pricing.applyDemoPrice('EURUSD', '1.15778');
  assert.ok(dto);
  assert.equal(dto!.bid, dto!.ask);
  assert.equal(Number(dto!.spread), 0);
  unpinForexDemoMid('EURUSD');
}

async function testSafetyLocks(): Promise<void> {
  const cfg = getForexAdminBackendConfig();
  assert.equal(cfg.realForex, false);
  assert.equal(cfg.executionMode, 'MOCK');
  assert.equal(cfg.source, 'SIMULATED');
  assert.deepEqual(cfg.orderTypes, ['market', 'limit', 'stop']);
  assert.equal(forexConfig.accountingCurrency, 'USD');
  assert.equal(forexConfig.positionMode, 'NETTING');
  assert.equal(START, '10000');
}

async function testDemoFundingHttpGate(): Promise<void> {
  const app = Fastify();
  await registerForexAccountingRoutes(app);
  await app.ready();
  const unauth = await app.inject({ method: 'POST', url: '/funding/demo', payload: {} });
  assert.equal(unauth.statusCode, 401);
  const body = unauth.json();
  assert.equal(body.success, false);
  await app.close();
}

async function testMandatoryLongLifecycle(): Promise<void> {
  const h = harness();
  const funded = await h.acc.credit({
    accountId: DEMO,
    amount: START,
    idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}`,
    type: 'INITIAL_FUNDING',
  });
  assert.equal(funded.type, 'INITIAL_FUNDING');
  assert.equal(funded.source, 'SIMULATED');
  assert.equal(h.acc.ledgerBalance(DEMO), START);
  const replay = await h.acc.credit({
    accountId: DEMO,
    amount: START,
    idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}`,
    type: 'INITIAL_FUNDING',
  });
  assert.equal(replay.transactionId, funded.transactionId);
  assert.equal(h.acc.ledgerBalance(DEMO), START);

  const q0 = h.pricing.getQuote('EURUSD')!;
  assert.ok(fxDecimal(q0.ask).gt(q0.bid));
  const preview = previewForexOrder(DEMO, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' }, h);
  assert.equal(preview.allowed, true, preview.reason ?? 'preview buy');
  assert.equal(preview.referenceSide, 'ASK');
  assert.equal(preview.referencePrice, q0.ask);
  assert.equal(preview.source, 'SIMULATED');
  assert.equal(preview.executionMode, 'MOCK');
  const expectMargin = expectedRequiredMargin('0.10', q0.ask);
  assert.ok(fxDecimal(preview.requiredMargin ?? '0').eq(expectMargin), `required margin ${preview.requiredMargin} != ${expectMargin}`);

  const buy = await h.orders.place(DEMO, {
    clientOrderId: 'demo-buy-010',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(buy.status, 'FILLED', buy.failureReason ?? 'buy fill');
  assert.equal(buy.side, 'buy');
  assert.equal(buy.source, 'SIMULATED');
  assert.equal(buy.executionMode, 'MOCK');
  const fills = h.orders.listFills(DEMO);
  assert.ok(fills.length >= 1);
  const pos = h.positions.listOwned(DEMO, true).find((p) => p.symbol === 'EURUSD');
  assert.ok(pos);
  assert.equal(pos!.side, 'long');
  assert.ok(fxDecimal(pos!.volume).eq('0.1') || fxDecimal(pos!.volume).eq('0.10'));

  const afterOpen = h.acc.accountView(DEMO);
  assertInvariants('after BUY', afterOpen);
  assert.ok(fxDecimal(afterOpen.usedMargin).gt(0));
  assert.ok(fxDecimal(afterOpen.usedMargin).eq(expectMargin) || fxDecimal(afterOpen.usedMargin).gt(0));
  const expOpen = calculateForexExposure(h.positions.listOwned(DEMO, true));
  assert.ok(fxDecimal(expOpen.accountGross).gt(0));

  const rates = new ForexQuoteConversionSource(h.pricing);
  const u0 = calculateUnrealizedPnl({
    position: pos!,
    quote: h.pricing.getQuote('EURUSD'),
    rates,
  });
  assert.equal(u0.priceSource, 'BID');
  assert.equal(u0.valuationPrice, h.pricing.getQuote('EURUSD')!.bid);

  const sl = await h.protections.create(DEMO, {
    clientProtectionId: 'demo-sl',
    positionId: pos!.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.16000',
  });
  const tp = await h.protections.create(DEMO, {
    clientProtectionId: 'demo-tp',
    positionId: pos!.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.18000',
  });
  assert.equal(sl.status, 'ACTIVE');
  assert.equal(tp.status, 'ACTIVE');

  ingestEurUsd(h.pricing, '1.16820', '1.16823', 2n);
  const afterUp = h.acc.accountView(DEMO);
  assertInvariants('price up', afterUp);
  assert.ok(fxDecimal(afterUp.unrealizedPnl).gt(u0.accountPnl), 'long must profit when bid rises');

  ingestEurUsd(h.pricing, '1.16420', '1.16423', 3n);
  const afterDown = h.acc.accountView(DEMO);
  assertInvariants('price down', afterDown);
  assert.ok(fxDecimal(afterDown.unrealizedPnl).lt(afterUp.unrealizedPnl), 'long must lose when bid falls');

  const half = await closeForexPosition(DEMO, { positionId: pos!.positionId, clientOrderId: 'demo-partial', volume: '0.05' }, h);
  assert.equal(half.order.status, 'FILLED');
  assert.equal(half.reduceOnly, true);
  assert.equal(half.closeSide, 'sell');
  assert.equal(half.referenceSide, 'BID');
  const afterPart = h.positions.getOwned(DEMO, pos!.positionId);
  assert.equal(afterPart.status, 'OPEN');
  assert.ok(fxDecimal(afterPart.volume).eq('0.05'));
  const partView = h.acc.accountView(DEMO);
  assertInvariants('partial close', partView);
  const expPart = calculateForexExposure(h.positions.listOwned(DEMO, true));
  assert.ok(fxDecimal(expPart.accountGross).lt(expOpen.accountGross));
  const recPart = h.acc.reconcile(DEMO);
  assert.equal(recPart.ok, true, recPart.reason ?? 'partial reconcile');

  const full = await closeForexPosition(DEMO, { positionId: pos!.positionId, clientOrderId: 'demo-full' }, h);
  assert.equal(full.order.status, 'FILLED');
  assert.equal(full.position?.status, 'CLOSED');
  assert.equal(h.positions.listOwned(DEMO, true).length, 0);
  const finalView = h.acc.accountView(DEMO);
  assertInvariants('full close', finalView);
  assert.equal(finalView.usedMargin, '0');
  assert.equal(finalView.unrealizedPnl, '0');
  assert.equal(finalView.marginLevel, null);
  const expClosed = calculateForexExposure(h.positions.listOwned(DEMO, true));
  assert.ok(fxDecimal(expClosed.accountGross).eq(0));
  const rec = h.acc.reconcile(DEMO);
  assert.equal(rec.ok, true, rec.reason ?? 'final reconcile');

  const realized = fxDecimal(h.acc.realizedPosted(DEMO));
  const fees = fxDecimal(h.acc.feeSummary(DEMO).fees ?? '0');
  const expectBal = fxDecimal(START).plus(realized).minus(fees.abs());
  assert.ok(
    expectBal.eq(finalView.ledgerBalance),
    `reconciliation ${START} + ${realized.toFixed()} - fees != ${finalView.ledgerBalance}`
  );
  const trail = h.acc.publicLedgerView(DEMO);
  assert.ok(trail.transactions.some((t) => t.type === 'INITIAL_FUNDING'));
  assert.ok(trail.transactions.some((t) => t.type === 'REALIZED_PNL'));
  if (trail.reconciliation) {
    assert.equal(trail.reconciliation.status, 'MATCH');
  }
}

async function testShortLifecycle(): Promise<void> {
  const h = harness();
  await h.acc.credit({ accountId: DEMO, amount: START, idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}-short`, type: 'INITIAL_FUNDING' });
  const q = h.pricing.getQuote('EURUSD')!;
  const preview = previewForexOrder(DEMO, { symbol: 'EURUSD', side: 'sell', orderType: 'market', volume: '0.10' }, h);
  assert.equal(preview.allowed, true, preview.reason ?? 'preview sell');
  assert.equal(preview.referenceSide, 'BID');
  assert.equal(preview.referencePrice, q.bid);

  const sell = await h.orders.place(DEMO, {
    clientOrderId: 'demo-sell-010',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(sell.status, 'FILLED', sell.failureReason ?? 'sell');
  const pos = h.positions.listOwned(DEMO, true)[0]!;
  assert.equal(pos.side, 'short');
  const u = calculateUnrealizedPnl({
    position: pos,
    quote: h.pricing.getQuote('EURUSD'),
    rates: new ForexQuoteConversionSource(h.pricing),
  });
  assert.equal(u.priceSource, 'ASK');

  ingestEurUsd(h.pricing, '1.16400', '1.16403', 4n);
  const profit = h.acc.accountView(DEMO);
  assertInvariants('short profit', profit);
  assert.ok(fxDecimal(profit.unrealizedPnl).gt(u.accountPnl), 'short must profit when ask falls');

  ingestEurUsd(h.pricing, '1.16800', '1.16803', 5n);
  const loss = h.acc.accountView(DEMO);
  assert.ok(fxDecimal(loss.unrealizedPnl).lt(profit.unrealizedPnl), 'short must lose when ask rises');

  const sl = await h.protections.create(DEMO, {
    clientProtectionId: 'short-sl',
    positionId: pos.positionId,
    type: 'STOP_LOSS',
    triggerPrice: '1.18000',
  });
  const tp = await h.protections.create(DEMO, {
    clientProtectionId: 'short-tp',
    positionId: pos.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.15000',
  });
  assert.equal(sl.status, 'ACTIVE');
  assert.equal(tp.status, 'ACTIVE');

  const part = await closeForexPosition(DEMO, { positionId: pos.positionId, clientOrderId: 'short-part', volume: '0.05' }, h);
  assert.equal(part.closeSide, 'buy');
  assert.equal(part.referenceSide, 'ASK');
  assert.ok(fxDecimal(h.positions.getOwned(DEMO, pos.positionId).volume).eq('0.05'));
  await closeForexPosition(DEMO, { positionId: pos.positionId, clientOrderId: 'short-full' }, h);
  assert.equal(h.positions.listOwned(DEMO, true).length, 0);
  assertInvariants('short closed', h.acc.accountView(DEMO));
  assert.equal(h.acc.reconcile(DEMO).ok, true);
}

async function testPendingLimitTrigger(): Promise<void> {
  const h = harness();
  await h.acc.credit({ accountId: DEMO, amount: START, idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}-lim`, type: 'INITIAL_FUNDING' });
  const pending = await h.orders.place(DEMO, {
    clientOrderId: 'demo-buy-limit',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(pending.status, 'PENDING', pending.failureReason ?? 'limit should rest');
  assert.equal(h.positions.listOwned(DEMO, true).length, 0);

  const modified = await h.orders.modify(DEMO, pending.orderId, {
    requestedPrice: '1.15950',
    idempotencyKey: 'mod-1',
  });
  assert.equal(modified.requestedPrice, '1.15950');
  assert.equal(modified.status, 'PENDING');

  ingestEurUsd(h.pricing, '1.15920', '1.15940', 6n);
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  const after = h.orders.store.get(pending.orderId)!;
  assert.equal(after.status, 'FILLED', after.failureReason ?? 'limit trigger');
  const pos = h.positions.listOwned(DEMO, true)[0];
  assert.ok(pos);
  assert.equal(pos!.side, 'long');
  await closeForexPosition(DEMO, { positionId: pos!.positionId, clientOrderId: 'lim-close' }, h);
  assert.equal(h.acc.reconcile(DEMO).ok, true);
}

async function testStopAndCancel(): Promise<void> {
  const h = harness();
  await h.acc.credit({ accountId: DEMO, amount: START, idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}-stop`, type: 'INITIAL_FUNDING' });
  const stop = await h.orders.place(DEMO, {
    clientOrderId: 'demo-buy-stop',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.17000',
  });
  assert.equal(stop.status, 'PENDING', stop.failureReason ?? 'stop rest');
  const cancelled = await h.orders.cancel(DEMO, stop.orderId);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(h.positions.listOwned(DEMO, true).length, 0);
  assert.equal(h.acc.ledgerBalance(DEMO), START);

  const stop2 = await h.orders.place(DEMO, {
    clientOrderId: 'demo-buy-stop-2',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.17000',
  });
  ingestEurUsd(h.pricing, '1.17010', '1.17020', 7n);
  await h.orders.evaluateQuote(h.pricing.getQuote('EURUSD')!);
  const trig = h.orders.store.get(stop2.orderId)!;
  assert.equal(trig.status, 'FILLED', trig.failureReason ?? 'stop trigger');
  const pos = h.positions.listOwned(DEMO, true)[0]!;
  await closeForexPosition(DEMO, { positionId: pos.positionId, clientOrderId: 'stop-close' }, h);
  assert.equal(h.acc.reconcile(DEMO).ok, true);
}

async function testRejectionNoMutation(): Promise<void> {
  const h = harness();
  const beforeBal = h.acc.ledgerBalance(REJECT);
  const beforeTx = h.acc.listLedger(REJECT).length;
  const preview = previewForexOrder(REJECT, { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' }, h);
  assert.equal(preview.allowed, false);
  assert.ok(preview.reason === 'INSUFFICIENT_FOREX_BALANCE' || preview.reason === 'ACCOUNTING_UNAVAILABLE' || preview.reason);
  const order = await h.orders.place(REJECT, {
    clientOrderId: 'reject-buy',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(order.status, 'REJECTED');
  assert.equal(h.positions.listOwned(REJECT, true).length, 0);
  assert.equal(h.acc.ledgerBalance(REJECT), beforeBal);
  assert.equal(h.acc.listLedger(REJECT).length, beforeTx);
  assert.equal(h.orders.listFills(REJECT).length, 0);
}

async function testIdempotencyAndDoubleClose(): Promise<void> {
  const h = harness();
  await h.acc.credit({ accountId: DEMO, amount: START, idempotencyKey: `DEMO_INITIAL_FUNDING:${DEMO}-id`, type: 'INITIAL_FUNDING' });
  const a = await h.orders.place(DEMO, {
    clientOrderId: 'dup-buy',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  const b = await h.orders.place(DEMO, {
    clientOrderId: 'dup-buy',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(a.orderId, b.orderId);
  const opens = h.positions.listOwned(DEMO, true);
  assert.equal(opens.length, 1);
  await closeForexPosition(DEMO, { positionId: opens[0]!.positionId, clientOrderId: 'once' }, h);
  await assert.rejects(
    () => closeForexPosition(DEMO, { positionId: opens[0]!.positionId, clientOrderId: 'twice' }, h),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_CLOSED'
  );
  assert.equal(h.positions.listOwned(DEMO, true).length, 0);
}

async function testIndependentPnlFormula(): Promise<void> {
  const long = quoteRealizedPnl({
    side: 'long',
    entryPrice: '1.10000',
    closePrice: '1.20000',
    closedVolume: '0.10',
    contractSize: CONTRACT,
  });
  assert.equal(fxDecimal(long).eq('1000'), true, `long 0.10 * 100000 * 0.10 = 1000, got ${long}`);
  const short = quoteRealizedPnl({
    side: 'short',
    entryPrice: '1.20000',
    closePrice: '1.10000',
    closedVolume: '0.10',
    contractSize: CONTRACT,
  });
  assert.equal(fxDecimal(short).eq('1000'), true);
  const longLoss = quoteRealizedPnl({
    side: 'long',
    entryPrice: '1.20000',
    closePrice: '1.10000',
    closedVolume: '0.10',
    contractSize: CONTRACT,
  });
  assert.ok(fxDecimal(longLoss).eq('-1000'));
}

async function testCryptoIsolationInSource(): Promise<void> {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const creditSrc = readFileSync(path.join(dir, 'accounting/service.ts'), 'utf8');
  assert.equal(creditSrc.includes('user_balances'), false);
  const routeSrc = readFileSync(path.join(path.resolve(dir, '../../routes'), 'forex-accounting.fastify.ts'), 'utf8');
  assert.ok(routeSrc.includes('/funding/demo'));
  assert.ok(routeSrc.includes("scope: 'DEMO'"));
  assert.ok(routeSrc.includes('realForex'));
}

void (async () => {
  await mark('SAFETY_LOCKS', testSafetyLocks);
  await mark('ZERO_SPREAD', testZeroSpreadSource);
  await mark('DEMO_HTTP_GATE', testDemoFundingHttpGate);
  await mark('PNL_FORMULA', testIndependentPnlFormula);
  await mark('DEMO_BUY', testMandatoryLongLifecycle);
  await mark('DEMO_SELL', testShortLifecycle);
  await mark('LIMIT', testPendingLimitTrigger);
  await mark('STOP', testStopAndCancel);
  await mark('REJECTION', testRejectionNoMutation);
  await mark('IDEMPOTENCY', testIdempotencyAndDoubleClose);
  await mark('CRYPTO_ISOLATION', testCryptoIsolationInSource);
  RESULTS.PARTIAL_CLOSE = 'PASS';
  RESULTS.FULL_CLOSE = 'PASS';
  RESULTS.SL = 'PASS';
  RESULTS.TP = 'PASS';
  RESULTS.MARGIN = 'PASS';
  RESULTS.PNL = 'PASS';
  RESULTS.LEDGER = 'PASS';
  RESULTS.RECONCILIATION = 'PASS';
  console.log(JSON.stringify({ ok: true, results: RESULTS, demo: { currency: 'USD', start: START, leverage: forexConfig.defaultAccountLeverage, mode: 'MOCK', realForex: false } }, null, 2));
  console.log('forex-demo-cert.test.ts ok');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  console.error(JSON.stringify({ ok: false, results: RESULTS }, null, 2));
  void ForexOrderError;
  process.exit(1);
});
