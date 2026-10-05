/**
 * Phase A — STOP LIMIT order type + TIME IN FORCE (GTC / IOC / FOK / DAY)
 * + the append-only account journal.
 * SIMULATED / MOCK only. Forex isolated: no Crypto/Spot tables are touched.
 *
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-phase-a-orders.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { getForexAdminBackendConfig, getForexCustomerTradingConfig } from './admin/config.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import {
  FOREX_JOURNAL_METADATA_KEYS,
  publicForexJournalEvent,
  sanitizeJournalMetadata,
} from './journal/models.js';
import {
  clampForexJournalLimit,
  FOREX_JOURNAL_DEFAULT_LIMIT,
  FOREX_JOURNAL_MAX_LIMIT,
  resetForexJournalServiceForTests,
} from './journal/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { asMock, createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { publicForexOrder } from './orders/models.js';
import {
  isForexPendingOrderType,
  isPendingTriggered,
  isStopLimitMarketable,
  pendingTriggerValid,
} from './orders/pending.js';
import { orderFingerprint } from './orders/request.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { validateForexOrderRequest } from './orders/validate.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import { resetForexRiskServiceForTests } from './risk/service.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';
import type { ForexQuoteDto, ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const USER = 'phase-a-user';

/** Weekday inside the 24x5 window so pending orders can be placed. */
const OPEN_CLOCK = new Date('2026-09-01T12:00:00.000Z');
/** Saturday — session closed for every calendar. */
const CLOSED_CLOCK = new Date('2026-09-05T12:00:00.000Z');

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook(now = new Date()) {
  const pricing = resetForexPricingServiceForTests();
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623' }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624' }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622' }), now);
  return pricing;
}

function harness() {
  setForexSessionNowForTests(OPEN_CLOCK);
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetForexSessionExceptionsForTests();
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const venues = createMockExecutionVenues();
  const exec = new ForexExecutionService(pricing, venues, new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  resetForexRiskServiceForTests(positions, pricing);
  return { pricing, positions, orders, acc, exec, venues };
}

async function funded() {
  const h = harness();
  await h.acc.credit({ accountId: USER, amount: '100000', idempotencyKey: `DEPOSIT:pa-${Date.now()}-${Math.round(performance.now() * 1000)}`, type: 'DEPOSIT' });
  return h;
}

function usableQuote(pricing: ReturnType<typeof seedBook>, patch: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  const q = pricing.getQuote('EURUSD')!;
  return { ...q, freshness: 'FRESH', quality: 'OK', status: 'TRADEABLE', ...patch };
}

// --- config surface ---
{
  const admin = getForexAdminBackendConfig();
  const customer = getForexCustomerTradingConfig();
  assert.deepEqual(admin.orderTypes, ['market', 'limit', 'stop', 'stop_limit']);
  assert.deepEqual(customer.orderTypes, ['market', 'limit', 'stop', 'stop_limit']);
  assert.deepEqual(customer.timeInForce, ['GTC', 'IOC', 'FOK', 'DAY', 'GTD', 'RETURN', 'BOC']);
  assert.ok(customer.capabilities?.orderTypes.stopLimit.engine === true);
  assert.ok(customer.capabilities?.orderTypes.stopLimit.customerExposed === true);
  assert.ok(customer.capabilities?.timeInForce.day.engine === true);
  assert.ok(customer.capabilities?.timeInForce.day.customerExposed === true);
  assert.ok(customer.capabilities?.timeInForce.ioc.customerExposed === true);
  assert.ok(customer.capabilities?.timeInForce.fok.customerExposed === true);
  assert.ok(customer.capabilities?.timeInForce.gtd.engine === true);
  assert.equal(isForexPendingOrderType('stop_limit'), true);
  assert.equal(isForexPendingOrderType('market'), false);
  console.log('  PASS  trading-config customer exposure + capability contract');
}

// --- unit: stop_limit trigger + marketability ---
{
  const q = { bid: '1.16621', ask: '1.16623' } as ForexQuoteDto;
  // BUY stop_limit triggers when ask >= stop (same as BUY STOP).
  assert.equal(isPendingTriggered({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.16600' }, q), true);
  assert.equal(isPendingTriggered({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.17000' }, q), false);
  // SELL stop_limit triggers when bid <= stop (same as SELL STOP).
  assert.equal(isPendingTriggered({ orderType: 'stop_limit', side: 'sell', requestedPrice: '1.16700' }, q), true);
  assert.equal(isPendingTriggered({ orderType: 'stop_limit', side: 'sell', requestedPrice: '1.16000' }, q), false);

  assert.equal(isStopLimitMarketable('buy', '1.16700', q), true);
  assert.equal(isStopLimitMarketable('buy', '1.16500', q), false);
  assert.equal(isStopLimitMarketable('sell', '1.16500', q), true);
  assert.equal(isStopLimitMarketable('sell', '1.16700', q), false);
  assert.equal(isStopLimitMarketable('buy', null, q), false);
  console.log('  PASS  stop_limit trigger + marketability math');
}

// --- unit: stop vs limit relationship ---
{
  // BUY: limit must sit at or below the stop.
  assert.equal(pendingTriggerValid({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.17000', limitPrice: '1.17000' }).ok, true);
  assert.equal(pendingTriggerValid({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.17000', limitPrice: '1.16900' }).ok, true);
  const buyBad = pendingTriggerValid({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.17000', limitPrice: '1.17100' });
  assert.equal(buyBad.ok, false);
  assert.equal(buyBad.ok === false && buyBad.reason, 'INVALID_TRIGGER_RELATIONSHIP');

  // SELL: limit must sit at or above the stop.
  assert.equal(pendingTriggerValid({ orderType: 'stop_limit', side: 'sell', requestedPrice: '1.16000', limitPrice: '1.16100' }).ok, true);
  const sellBad = pendingTriggerValid({ orderType: 'stop_limit', side: 'sell', requestedPrice: '1.16000', limitPrice: '1.15900' });
  assert.equal(sellBad.ok, false);
  assert.equal(sellBad.ok === false && sellBad.reason, 'INVALID_TRIGGER_RELATIONSHIP');

  const missingLimit = pendingTriggerValid({ orderType: 'stop_limit', side: 'buy', requestedPrice: '1.17000' });
  assert.equal(missingLimit.ok === false && missingLimit.reason, 'INVALID_LIMIT_PRICE');
  const missingStop = pendingTriggerValid({ orderType: 'stop_limit', side: 'buy', limitPrice: '1.17000' });
  assert.equal(missingStop.ok === false && missingStop.reason, 'INVALID_PRICE');

  // Existing limit/stop behaviour is unchanged.
  assert.equal(pendingTriggerValid({ orderType: 'limit', side: 'buy', requestedPrice: '1.16000' }).ok, true);
  assert.equal(pendingTriggerValid({ orderType: 'stop', side: 'buy' }).ok, false);
  assert.equal(pendingTriggerValid({ orderType: 'market', side: 'buy' }).ok, true);
  console.log('  PASS  stop_limit stop/limit relationship rules');
}

// --- unit: request validation ---
{
  setForexSessionNowForTests(OPEN_CLOCK);
  const base = { clientOrderId: 'v-1', symbol: 'EURUSD', volume: '0.10' } as const;

  const okBuy = validateForexOrderRequest({ ...base, side: 'buy', orderType: 'stop_limit', requestedPrice: '1.17000', limitPrice: '1.16950' });
  assert.equal(okBuy.ok, true);

  const badRel = validateForexOrderRequest({ ...base, side: 'buy', orderType: 'stop_limit', requestedPrice: '1.17000', limitPrice: '1.17500' });
  assert.equal(badRel.ok, false);
  assert.equal(badRel.ok === false && badRel.reason, 'INVALID_TRIGGER_RELATIONSHIP');

  const noLimit = validateForexOrderRequest({ ...base, side: 'sell', orderType: 'stop_limit', requestedPrice: '1.16000' });
  assert.equal(noLimit.ok === false && noLimit.reason, 'INVALID_LIMIT_PRICE');

  const negLimit = validateForexOrderRequest({ ...base, side: 'sell', orderType: 'stop_limit', requestedPrice: '1.16000', limitPrice: '0' });
  assert.equal(negLimit.ok === false && negLimit.reason, 'INVALID_LIMIT_PRICE');

  const precision = validateForexOrderRequest({ ...base, side: 'sell', orderType: 'stop_limit', requestedPrice: '1.16000', limitPrice: '1.1600012345' });
  assert.equal(precision.ok === false && precision.reason, 'INVALID_LIMIT_PRICE');

  const badTif = validateForexOrderRequest({ ...base, side: 'buy', orderType: 'market', timeInForce: 'XXX' as never });
  assert.equal(badTif.ok === false && badTif.reason, 'INVALID_TIME_IN_FORCE');
  console.log('  PASS  stop_limit / TIF request validation');
}

// --- unit: fingerprint stability ---
{
  const legacy = orderFingerprint({ clientOrderId: 'f', symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '0.10', requestedPrice: '1.16000' });
  assert.equal(legacy, 'EURUSD|buy|0.10|limit|1.16000', 'legacy fingerprints must not change shape');
  const withDefaultTif = orderFingerprint({ clientOrderId: 'f', symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '0.10', requestedPrice: '1.16000', timeInForce: 'GTC' });
  assert.equal(withDefaultTif, legacy);
  const stopLimit = orderFingerprint({ clientOrderId: 'f', symbol: 'EURUSD', side: 'buy', orderType: 'stop_limit', volume: '0.10', requestedPrice: '1.17000', limitPrice: '1.16950' });
  assert.equal(stopLimit, 'EURUSD|buy|0.10|stop_limit|1.17000|1.16950|GTC');
  console.log('  PASS  idempotency fingerprint stays backward compatible');
}

// --- BUY stop_limit: stop hit, limit not marketable → keeps working as limit ---
{
  const { orders, pricing } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'pa-buy-sl-work',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16900',
  });
  assert.equal(o.status, 'PENDING', String(o.failureReason));
  assert.equal(o.orderType, 'stop_limit');
  assert.equal(o.requestedPrice, '1.17000');
  assert.equal(o.limitPrice, '1.16900');
  assert.equal(o.timeInForce, 'GTC');

  // Stop is hit (ask >= 1.17000) but the limit (1.16900) is far away.
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.17000', ask: '1.17010', edaReceiveSequence: 'pa-buy-1' }));
  const working = await orders.getOwned(USER, o.orderId);
  assert.equal(working.status, 'PENDING', 'stop_limit must keep working, not market-fill');
  assert.equal(working.orderType, 'limit', 'triggered stop_limit becomes a pending limit');
  assert.equal(working.requestedPrice, '1.16900', 'limit price becomes the working trigger');
  assert.equal(working.limitPrice, '1.16900');
  assert.equal(working.executionId, null);
  assert.ok(working.events.some((e) => e.reason === 'STOP_LIMIT_ACTIVATED'));
  assert.equal(working.fingerprint, orderFingerprint({ clientOrderId: 'pa-buy-sl-work', symbol: 'EURUSD', side: 'buy', orderType: 'stop_limit', volume: '0.10', requestedPrice: '1.17000', limitPrice: '1.16900' }), 'activation must not rewrite the idempotency fingerprint');

  // Now the market comes back to the limit and the existing limit path fills it.
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.16880', ask: '1.16890', edaReceiveSequence: 'pa-buy-2' }));
  const filled = await orders.getOwned(USER, o.orderId);
  assert.equal(filled.status, 'FILLED', String(filled.failureReason));
  assert.equal(filled.filledVolume, '0.1');
  console.log('  PASS  BUY stop_limit works as limit after the stop triggers');
}

// --- BUY stop_limit: stop hit and limit already marketable → immediate fill ---
{
  const { orders, pricing } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'pa-buy-sl-fill',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.17000',
  });
  assert.equal(o.status, 'PENDING', String(o.failureReason));
  // ask 1.17000 >= stop 1.17000 and ask <= limit 1.17000 → marketable straight away.
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.16990', ask: '1.17000', edaReceiveSequence: 'pa-buy-fill' }));
  const after = await orders.getOwned(USER, o.orderId);
  assert.equal(after.status, 'FILLED', String(after.failureReason));
  assert.equal(after.orderType, 'stop_limit', 'a straight-through fill keeps the original type for audit');
  assert.ok(after.executionId);
  console.log('  PASS  BUY stop_limit fills immediately when the limit is marketable');
}

// --- SELL stop_limit ---
{
  const { orders, pricing } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'pa-sell-sl',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.16000',
    limitPrice: '1.16100',
  });
  assert.equal(o.status, 'PENDING', String(o.failureReason));
  // bid 1.15990 <= stop 1.16000 triggers, but bid < limit 1.16100 so it rests.
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.15990', ask: '1.16000', edaReceiveSequence: 'pa-sell-1' }));
  const working = await orders.getOwned(USER, o.orderId);
  assert.equal(working.status, 'PENDING');
  assert.equal(working.orderType, 'limit');
  assert.equal(working.requestedPrice, '1.16100');
  // bid climbs back above the limit → SELL limit triggers.
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.16110', ask: '1.16120', edaReceiveSequence: 'pa-sell-2' }));
  assert.equal((await orders.getOwned(USER, o.orderId)).status, 'FILLED');
  console.log('  PASS  SELL stop_limit trigger then limit fill');
}

// --- stop_limit rejections at placement ---
{
  const { orders } = await funded();
  const badRel = await orders.place(USER, {
    clientOrderId: 'pa-sl-badrel',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.17500',
  });
  assert.equal(badRel.status, 'REJECTED');
  assert.equal(badRel.failureReason, 'INVALID_TRIGGER_RELATIONSHIP');

  const noLimit = await orders.place(USER, {
    clientOrderId: 'pa-sl-nolimit',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(noLimit.status, 'REJECTED');
  assert.equal(noLimit.failureReason, 'INVALID_LIMIT_PRICE');
  console.log('  PASS  stop_limit placement rejections');
}

// --- modify patches the working limit price ---
{
  const { orders } = await funded();
  const o = await orders.place(USER, {
    clientOrderId: 'pa-sl-mod',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16900',
  });
  assert.equal(o.status, 'PENDING');
  const m = await orders.modify(USER, o.orderId, { limitPrice: '1.16950', expectedVersion: 1, idempotencyKey: 'pa-mod-1' });
  assert.equal(m.limitPrice, '1.16950');
  assert.equal(m.requestedPrice, '1.17000', 'stop price is untouched');
  assert.equal(m.version, 2);
  assert.equal(publicForexOrder(m).limitPrice, '1.16950');

  let rejected = false;
  try {
    await orders.modify(USER, o.orderId, { limitPrice: '1.17500', expectedVersion: 2, idempotencyKey: 'pa-mod-2' });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, 'modify must keep enforcing limit <= stop for a buy');
  console.log('  PASS  modify patches limitPrice for pending stop_limit');
}

// --- TIF: GTC is the default and existing types are untouched ---
{
  const { orders } = await funded();
  const mkt = await orders.place(USER, {
    clientOrderId: 'pa-tif-default',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(mkt.status, 'FILLED', String(mkt.failureReason));
  assert.equal(mkt.timeInForce, 'GTC');
  assert.equal(publicForexOrder(mkt).timeInForce, 'GTC');

  const lim = await orders.place(USER, {
    clientOrderId: 'pa-tif-lim',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
    timeInForce: 'GTC',
  });
  assert.equal(lim.status, 'PENDING');
  assert.equal(lim.timeInForce, 'GTC');
  console.log('  PASS  TIF defaults to GTC');
}

// --- TIF: IOC / FOK market orders fill fully in MOCK ---
{
  const { orders } = await funded();
  const ioc = await orders.place(USER, {
    clientOrderId: 'pa-ioc-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'IOC',
  });
  assert.equal(ioc.status, 'FILLED', String(ioc.failureReason));
  assert.equal(ioc.timeInForce, 'IOC');
  assert.equal(ioc.remainingVolume, '0');

  const fok = await orders.place(USER, {
    clientOrderId: 'pa-fok-mkt',
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'FOK',
  });
  assert.equal(fok.status, 'FILLED', String(fok.failureReason));
  assert.equal(fok.timeInForce, 'FOK');
  console.log('  PASS  IOC/FOK market orders fill fully in MOCK');
}

/**
 * Starve every mock venue so the requested volume can never be completed.
 * The plan must outlast the venue retry budget, otherwise an exhausted plan
 * falls back to the mock's default full fill.
 */
function starveVenues(venues: Map<string, import('./execution/venue.js').ForexExecutionVenue>): void {
  const dribble = Array.from({ length: 8 }, () => '0.00100000');
  for (const code of ['MOCK-A', 'MOCK-B', 'MOCK-C']) asMock(venues.get(code))?.setFillPlan([...dribble]);
}

// --- TIF: IOC cancels an unfilled remainder ---
{
  const { orders, venues } = await funded();
  starveVenues(venues);
  const ioc = await orders.place(USER, {
    clientOrderId: 'pa-ioc-partial',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'IOC',
  });
  assert.equal(ioc.status, 'CANCELLED', `IOC remainder must not rest: ${ioc.status}`);
  assert.equal(ioc.failureReason, 'IOC_REMAINDER_CANCELLED');
  assert.ok(fxDecimal(ioc.filledVolume).gt(0), 'IOC should keep what it managed to fill');
  assert.ok(fxDecimal(ioc.remainingVolume).gt(0), 'IOC remainder must be non-zero for this fixture');
  assert.ok(fxDecimal(ioc.filledVolume).plus(ioc.remainingVolume).eq(ioc.requestedVolume));
  console.log('  PASS  IOC cancels the unfilled remainder');
}

// --- TIF: FOK cancels rather than resting on a partial ---
{
  const { orders, venues } = await funded();
  starveVenues(venues);
  const fok = await orders.place(USER, {
    clientOrderId: 'pa-fok-partial',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'FOK',
  });
  assert.equal(fok.status, 'CANCELLED');
  assert.equal(fok.failureReason, 'FOK_PARTIAL_CANCELLED');
  console.log('  PASS  FOK never rests on a partial fill');
}

// --- TIF: a partially filled GTC market order still rests as PARTIALLY_FILLED ---
{
  const { orders, venues } = await funded();
  starveVenues(venues);
  const gtc = await orders.place(USER, {
    clientOrderId: 'pa-gtc-partial',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(gtc.status, 'PARTIALLY_FILLED', 'GTC partial-fill behaviour must not change');
  assert.equal(gtc.failureReason, null);
  console.log('  PASS  GTC partial fill behaviour preserved');
}

// --- TIF: IOC / FOK rejected on pending order types ---
{
  const { orders } = await funded();
  for (const [id, tif, type, price] of [
    ['pa-ioc-lim', 'IOC', 'limit', '1.16000'],
    ['pa-fok-lim', 'FOK', 'limit', '1.16000'],
    ['pa-ioc-stop', 'IOC', 'stop', '1.17000'],
    ['pa-fok-stop', 'FOK', 'stop', '1.17000'],
  ] as const) {
    const o = await orders.place(USER, {
      clientOrderId: id,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: type,
      volume: '0.10',
      requestedPrice: price,
      timeInForce: tif,
    });
    assert.equal(o.status, 'REJECTED', `${tif} ${type} must be rejected`);
    assert.equal(o.failureReason, 'UNSUPPORTED_TIME_IN_FORCE');
  }
  const slIoc = await orders.place(USER, {
    clientOrderId: 'pa-ioc-stoplimit',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.16900',
    timeInForce: 'IOC',
  });
  assert.equal(slIoc.status, 'REJECTED');
  assert.equal(slIoc.failureReason, 'UNSUPPORTED_TIME_IN_FORCE');

  const dayMkt = await orders.place(USER, {
    clientOrderId: 'pa-day-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'DAY',
  });
  assert.equal(dayMkt.status, 'REJECTED', 'DAY is a pending-order TIF');
  assert.equal(dayMkt.failureReason, 'UNSUPPORTED_TIME_IN_FORCE');
  console.log('  PASS  IOC/FOK rejected on pending types, DAY rejected on market');
}

// --- TIF: DAY pending orders expire when the session closes ---
{
  const { orders, pricing } = await funded();
  const day = await orders.place(USER, {
    clientOrderId: 'pa-day-lim',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
    timeInForce: 'DAY',
  });
  const gtc = await orders.place(USER, {
    clientOrderId: 'pa-day-gtc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.15000',
  });
  const dayStopLimit = await orders.place(USER, {
    clientOrderId: 'pa-day-stoplimit',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'DAY',
  });
  assert.equal(day.status, 'PENDING', String(day.failureReason));
  assert.equal(gtc.status, 'PENDING', String(gtc.failureReason));
  assert.equal(dayStopLimit.status, 'PENDING', String(dayStopLimit.failureReason));
  assert.equal(orders.listPending(USER).length, 3);

  // Still open → nothing expires.
  assert.equal((await orders.expireDayOrders()).length, 0);
  assert.equal((await orders.getOwned(USER, day.orderId)).status, 'PENDING');

  setForexSessionNowForTests(CLOSED_CLOCK);
  await orders.evaluateQuote(usableQuote(pricing, { bid: '1.16500', ask: '1.16510', edaReceiveSequence: 'pa-day-close' }));

  const expiredLimit = await orders.getOwned(USER, day.orderId);
  assert.equal(expiredLimit.status, 'CANCELLED', 'DAY limit must expire at session close');
  assert.equal(expiredLimit.failureReason, 'DAY_ORDER_EXPIRED');
  assert.ok(expiredLimit.events.some((e) => e.eventType === 'ORDER_CANCELLED' && e.reason === 'DAY_ORDER_EXPIRED'));

  const expiredStopLimit = await orders.getOwned(USER, dayStopLimit.orderId);
  assert.equal(expiredStopLimit.status, 'CANCELLED');
  assert.equal(expiredStopLimit.failureReason, 'DAY_ORDER_EXPIRED');

  const survivor = await orders.getOwned(USER, gtc.orderId);
  assert.equal(survivor.status, 'PENDING', 'GTC pending orders must survive the session close');

  // Idempotent: a second sweep changes nothing.
  assert.equal((await orders.expireDayOrders()).length, 0);
  setForexSessionNowForTests(OPEN_CLOCK);
  console.log('  PASS  DAY pending orders expire when the session closes');
}

// --- existing limit / stop paths are untouched ---
{
  const { orders, pricing } = await funded();
  const lim = await orders.place(USER, {
    clientOrderId: 'pa-reg-lim',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.16000',
  });
  assert.equal(lim.status, 'PENDING');
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.15990', bid: '1.15980', edaReceiveSequence: 'pa-reg-lim' }));
  assert.equal((await orders.getOwned(USER, lim.orderId)).status, 'FILLED');

  const stop = await orders.place(USER, {
    clientOrderId: 'pa-reg-stop',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.17000',
  });
  assert.equal(stop.status, 'PENDING');
  await orders.evaluateQuote(usableQuote(pricing, { ask: '1.17010', bid: '1.17000', edaReceiveSequence: 'pa-reg-stop' }));
  const filledStop = await orders.getOwned(USER, stop.orderId);
  assert.equal(filledStop.status, 'FILLED');
  assert.equal(filledStop.orderType, 'stop', 'stop orders must still market-fill on trigger');
  console.log('  PASS  existing limit/stop trigger paths unchanged');
}

// --- journal: metadata sanitizer never leaks non-trading fields ---
{
  const clean = sanitizeJournalMetadata({
    symbol: 'EURUSD',
    side: 'buy',
    limitPrice: '1.16900',
    version: 2,
    reason: null,
    authorization: 'Bearer super-secret',
    accessToken: 'abc',
    password: 'hunter2',
    request: { headers: { cookie: 'sid=1' } },
    nested: ['a', 'b'],
  });
  assert.deepEqual(Object.keys(clean).sort(), ['limitPrice', 'reason', 'side', 'symbol', 'version']);
  assert.equal(clean.symbol, 'EURUSD');
  assert.equal(clean.version, 2);
  assert.equal(clean.reason, null);
  for (const key of Object.keys(clean)) {
    assert.ok((FOREX_JOURNAL_METADATA_KEYS as readonly string[]).includes(key), `${key} must be allowlisted`);
  }
  assert.deepEqual(sanitizeJournalMetadata(null), {});
  assert.deepEqual(sanitizeJournalMetadata(['secret']), {});

  assert.equal(clampForexJournalLimit(undefined), FOREX_JOURNAL_DEFAULT_LIMIT);
  assert.equal(clampForexJournalLimit('0'), FOREX_JOURNAL_DEFAULT_LIMIT);
  assert.equal(clampForexJournalLimit('25'), 25);
  assert.equal(clampForexJournalLimit('100000'), FOREX_JOURNAL_MAX_LIMIT);
  console.log('  PASS  journal metadata sanitizer + limit clamp');
}

// --- journal: order lifecycle appends account-scoped entries ---
{
  const journal = resetForexJournalServiceForTests();
  const { orders, pricing } = await funded();

  const filled = await orders.place(USER, {
    clientOrderId: 'pa-j-mkt',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  assert.equal(filled.status, 'FILLED', String(filled.failureReason));
  const afterFill = journal.list(USER);
  const fillEntry = afterFill.find((e) => e.eventType === 'ORDER_FILLED' && e.orderId === filled.orderId);
  assert.ok(fillEntry, 'a filled order must produce a journal entry');
  assert.equal(fillEntry!.category, 'order');
  assert.equal(fillEntry!.severity, 'info');
  assert.equal(fillEntry!.referenceId, 'pa-j-mkt');
  assert.equal(fillEntry!.metadata.symbol, 'EURUSD');
  assert.equal(fillEntry!.metadata.timeInForce, 'GTC');
  assert.ok(fillEntry!.message.includes('EURUSD'));

  const pub = publicForexJournalEvent(fillEntry!);
  assert.equal(pub.origin, 'SERVER');
  assert.equal(pub.source, 'SIMULATED');
  assert.equal(pub.timestamp, fillEntry!.createdAt);
  assert.equal((pub as Record<string, unknown>).accountId, undefined, 'public journal must not echo the account id');

  const pending = await orders.place(USER, {
    clientOrderId: 'pa-j-sl',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'DAY',
  });
  assert.equal(pending.status, 'PENDING', String(pending.failureReason));
  const pendingEntry = journal.list(USER).find((e) => e.eventType === 'ORDER_PENDING' && e.orderId === pending.orderId);
  assert.ok(pendingEntry, 'a working pending order must be journalled');
  assert.equal(pendingEntry!.metadata.orderType, 'stop_limit');
  assert.equal(pendingEntry!.metadata.limitPrice, '1.17900');
  assert.equal(pendingEntry!.metadata.timeInForce, 'DAY');
  assert.ok(
    journal.list(USER).some((e) => e.eventType === 'ORDER_ACCEPTED' && e.orderId === pending.orderId),
    'ACCEPTED must be journalled'
  );

  const modified = await orders.modify(USER, pending.orderId, {
    limitPrice: '1.17950',
    expectedVersion: 1,
    idempotencyKey: 'pa-j-mod',
  });
  assert.equal(modified.limitPrice, '1.17950');
  const modEntry = journal.list(USER).find((e) => e.eventType === 'ORDER_MODIFIED' && e.orderId === pending.orderId);
  assert.ok(modEntry, 'modify must be journalled');
  assert.equal(modEntry!.metadata.limitPrice, '1.17950');

  await orders.cancel(USER, pending.orderId);
  const cancelEntry = journal.list(USER).find((e) => e.eventType === 'ORDER_CANCELLED' && e.orderId === pending.orderId);
  assert.ok(cancelEntry, 'cancel must be journalled');
  assert.equal(cancelEntry!.severity, 'warn');

  const rejected = await orders.place(USER, {
    clientOrderId: 'pa-j-reject',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.18500',
  });
  assert.equal(rejected.status, 'REJECTED');
  const rejectEntry = journal.list(USER).find((e) => e.eventType === 'ORDER_REJECTED' && e.orderId === rejected.orderId);
  assert.ok(rejectEntry, 'reject must be journalled');
  assert.equal(rejectEntry!.severity, 'error');
  assert.equal(rejectEntry!.metadata.reason, 'INVALID_TRIGGER_RELATIONSHIP');

  // Newest first, and never cross-account.
  const list = journal.list(USER, 200);
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(list[i - 1]!.createdAt >= list[i]!.createdAt, 'journal must be newest-first');
  }
  assert.equal(journal.list('someone-else').length, 0, 'journal must be account-scoped');
  assert.equal(journal.list(USER, 2).length, 2, 'journal honours the limit');
  assert.equal(journal.list('').length, 0);

  // Non-lifecycle chatter stays in forex_order_events, not the customer journal.
  assert.equal(
    journal.list(USER, 200).some((e) => e.eventType === 'ORDER_ROUTING' || e.eventType === 'ORDER_SUBMITTED'),
    false,
    'routing chatter must not reach the customer journal'
  );
  void pricing;
  console.log('  PASS  order lifecycle appends account-scoped journal entries');
}

// --- journal: a rolled-back execution leaves no phantom fill line ---
{
  const journal = resetForexJournalServiceForTests();
  const { orders, venues } = await funded();
  starveVenues(venues);
  const ioc = await orders.place(USER, {
    clientOrderId: 'pa-j-ioc',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
    timeInForce: 'IOC',
  });
  assert.equal(ioc.status, 'CANCELLED');
  const entries = journal.list(USER, 200).filter((e) => e.orderId === ioc.orderId);
  assert.ok(
    entries.some((e) => e.eventType === 'ORDER_CANCELLED' && e.metadata.reason === 'IOC_REMAINDER_CANCELLED'),
    'IOC remainder cancel must be journalled'
  );
  assert.equal(
    entries.some((e) => e.eventType === 'ORDER_FILLED'),
    false,
    'a partially filled IOC never reached FILLED, so no filled line may exist'
  );
  console.log('  PASS  journal reports only committed order outcomes');
}

// --- Forex isolation: no Crypto/Spot surfaces ---
{
  const files = [
    'services/forex/orders/pending.ts',
    'services/forex/orders/service.ts',
    'services/forex/orders/validate.ts',
    'services/forex/orders/persist.ts',
    'services/forex/orders/request.ts',
    'services/forex/journal/models.ts',
    'services/forex/journal/store.ts',
    'services/forex/journal/service.ts',
    'services/forex/journal/persist.ts',
    'routes/forex-journal.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('Math.random'), false);
  }
  console.log('  PASS  Forex-only isolation');
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('\nforex-phase-a-orders.test: ok');
