/**
 * Broker gateway stays off the MOCK book.
 * Run: npx tsx --test src/services/forex/broker/gateway.test.ts
 */
import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';
import { db } from '../../../lib/database.js';
import { resetForexAccountingServiceForTests } from '../accounting/service.js';
import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { ForexExecutionService } from '../execution/service.js';
import { ForexExecutionStore } from '../execution/store.js';
import { createMockExecutionVenues } from '../execution/venues.js';
import type { ForexExecutionVenue } from '../execution/venue.js';
import { fxDecimal } from '../decimal-fx.js';
import { ForexOrderService } from '../orders/service.js';
import { ForexOrderStore } from '../orders/store.js';
import { ForexPositionService } from '../positions/service.js';
import { ForexPositionStore } from '../positions/store.js';
import { resetForexPricingServiceForTests } from '../quotes.service.js';
import { resetForexAccountPoliciesForTests } from '../risk/engine.js';
import { resetForexDealingForTests } from '../risk/dealing.js';
import { resetForexRiskLimitsForTests } from '../risk/policy.js';
import { resetForexRiskServiceForTests } from '../risk/service.js';
import { setForexSessionNowForTests } from '../sessions/eligibility.js';
import type { ProviderRawQuote } from '../types.js';
import { buildLiveForexReadiness } from '../customer/live-funding-readiness.js';
import { resetForexLiveAccountProviderForTests } from '../customer/live-account-provider.registry.js';
import { rememberForexAccountKind, resetForexAccountKindsForTests } from './account-kind.js';
import { creditForexAfterBrokerSettle } from './cash-rail.js';
import {
  brokerQuoteDto,
  getBrokerGateway,
  parseBrokerCash,
  parseBrokerHealth,
  parseBrokerOrder,
  parseBrokerQuotes,
  resetBrokerGatewayForTests,
  setBrokerFetchForTests,
  setBrokerGatewayConfigForTests,
  type BrokerFetch,
} from './gateway.js';

const LIVE = 'live-gw-acct';
const DEMO = 'demo-gw-acct';

function raw(p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook() {
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }), now);
  return pricing;
}

function readyFetch(cash: 'settled' | 'rejected' = 'settled'): BrokerFetch {
  return async (url, init) => {
    const auth = init?.headers?.authorization;
    if (auth !== 'Bearer test-key') return { ok: false, status: 401, json: async () => ({}) };
    if (url.endsWith('/v1/health')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, quotes: true, orders: true, accounts: true, cash: true }) };
    }
    if (url.includes('/v1/quotes')) {
      const timestamp = url.includes('stale=1') ? new Date(Date.now() - 60_000).toISOString() : new Date().toISOString();
      return {
        ok: true,
        status: 200,
        json: async () => ({ quotes: [{ symbol: 'EURUSD', bid: '1.30000', ask: '1.30010', timestamp }] }),
      };
    }
    if (url.endsWith('/v1/orders')) {
      const body = JSON.parse(init?.body ?? '{}') as { volume?: string };
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'filled', filledVolume: body.volume ?? '0', avgPrice: '1.25005', venueOrderId: 'BR-1' }),
      };
    }
    if (url.endsWith('/v1/cash')) {
      if (cash === 'rejected') return { ok: true, status: 200, json: async () => ({ status: 'rejected', reason: 'NO_FUNDS' }) };
      return { ok: true, status: 200, json: async () => ({ status: 'settled', brokerRef: 'CASH-1' }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

function useBroker(fetchImpl: BrokerFetch): void {
  setBrokerGatewayConfigForTests({ baseUrl: 'http://broker.test', apiKey: 'test-key' });
  setBrokerFetchForTests(fetchImpl);
}

function countingVenues(): { venues: Map<string, ForexExecutionVenue>; calls: () => number } {
  const venues = createMockExecutionVenues();
  let calls = 0;
  for (const venue of venues.values()) {
    const original = venue.placeOrder.bind(venue);
    venue.placeOrder = async (req) => {
      calls += 1;
      return original(req);
    };
  }
  return { venues, calls: () => calls };
}

afterEach(() => {
  resetBrokerGatewayForTests();
  resetForexAccountKindsForTests();
  resetForexLiveAccountProviderForTests();
  setForexSessionNowForTests(null);
});

after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await db.close();
});

describe('broker gateway parsers', () => {
  it('rejects a crossed quote, an overfill, and a cash settle with no reference', () => {
    assert.equal(brokerQuoteDto({ symbol: 'EURUSD', bid: '1.2', ask: '1.1', timestamp: new Date().toISOString() }, new Date()), null);
    const over = parseBrokerOrder({ status: 'filled', filledVolume: '2', avgPrice: '1.2', venueOrderId: 'x' }, '1');
    assert.equal(over.status, 'rejected');
    assert.equal(over.reason, 'MALFORMED_VENUE_RESPONSE');
    const cash = parseBrokerCash({ status: 'settled' });
    assert.equal(cash.ok, false);
    assert.deepEqual(parseBrokerQuotes({ quotes: [{ symbol: 'EURUSD', bid: '1.1', ask: '1.2' }] }).length, 1);
    assert.equal(parseBrokerHealth({ ok: true, quotes: true }).orders, false);
  });

  it('stays unconfigured when the broker URL is unset', async () => {
    const health = await getBrokerGateway().health();
    assert.equal(health.configured, false);
    assert.equal(health.orders, false);
    const readiness = await buildLiveForexReadiness();
    assert.equal(readiness.liveForexReady, false);
    assert.equal(readiness.capabilities.deposit, false);
    assert.ok(readiness.blockers.includes('Payment provider for Forex deposits not configured'));
  });
});

describe('live forex uses the broker, demo keeps the mock book', () => {
  it('does not credit the forex ledger when the broker rejects cash, and credits it after settle', async () => {
    const pricing = seedBook();
    const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
    const accounting = resetForexAccountingServiceForTests(positions, pricing);

    useBroker(readyFetch('rejected'));
    const rejected = await creditForexAfterBrokerSettle(accounting, {
      accountId: 'live-cash-reject',
      amount: '25',
      idempotencyKey: 'cash-reject-1',
    });
    assert.equal(rejected.ok, false);
    assert.equal(accounting.ledgerBalance('live-cash-reject'), '0');

    resetBrokerGatewayForTests();
    useBroker(readyFetch('settled'));
    const settled = await creditForexAfterBrokerSettle(accounting, {
      accountId: 'live-cash-ok',
      amount: '25',
      idempotencyKey: 'cash-ok-1',
    });
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.brokerRef, 'CASH-1');
    assert.equal(settled.transaction.source, 'SIMULATED');
    assert.equal(settled.transaction.metadata?.rail, 'BROKER');
    assert.equal(fxDecimal(accounting.ledgerBalance('live-cash-ok')).eq('25'), true);
  });

  it('marks a live position on the broker bid and a demo position on the mock bid', async () => {
    const pricing = seedBook();
    const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
    const stamp = new Date().toISOString();
    await positions.applyFills([
      { fillId: 'live-fill', accountId: LIVE, symbol: 'EURUSD', side: 'buy', volume: '0.10', price: '1.10000', timestamp: stamp },
      { fillId: 'demo-fill', accountId: DEMO, symbol: 'EURUSD', side: 'buy', volume: '0.10', price: '1.10000', timestamp: stamp },
    ]);
    rememberForexAccountKind(LIVE, 'LIVE');
    rememberForexAccountKind(DEMO, 'DEMO');
    useBroker(readyFetch());
    await getBrokerGateway().refreshQuotes(['EURUSD']);

    const live = positions.listOwned(LIVE, true)[0];
    const demo = positions.listOwned(DEMO, true)[0];
    assert.ok(live && demo);
    assert.equal(fxDecimal(live!.currentPrice).eq('1.3'), true);
    assert.equal(demo!.currentPrice, pricing.getQuote('EURUSD')!.bid);
    assert.equal(fxDecimal(demo!.currentPrice).eq('1.3'), false);

    resetBrokerGatewayForTests();
    useBroker(async (url, init) => {
      if (url.includes('/v1/quotes')) {
        return readyFetch()(url + '&stale=1', init);
      }
      return readyFetch()(url, init);
    });
    await getBrokerGateway().refreshQuotes(['EURUSD']);
    const stale = positions.listOwned(LIVE, true)[0];
    assert.equal(fxDecimal(stale!.currentPrice).eq('1.1'), true);
    assert.equal(fxDecimal(stale!.currentPrice).eq(pricing.getQuote('EURUSD')!.bid), false);
  });

  it('rejects a live order without a broker and fills a live order without calling the mock venue', async () => {
    setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
    resetForexAccountPoliciesForTests();
    resetForexRiskLimitsForTests();
    resetForexDealingForTests();
    const pricing = seedBook();
    const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
    const counted = countingVenues();
    const execution = new ForexExecutionService(pricing, counted.venues, new ForexExecutionStore(), false);
    const orders = new ForexOrderService(execution, new ForexOrderStore(), false, positions, pricing);
    const accounting = resetForexAccountingServiceForTests(positions, pricing);
    resetForexRiskServiceForTests(positions, pricing);
    await accounting.credit({ accountId: LIVE, amount: '100000', idempotencyKey: 'fund-live-gw', type: 'INITIAL_FUNDING' });
    await accounting.credit({ accountId: DEMO, amount: '100000', idempotencyKey: 'fund-demo-gw', type: 'INITIAL_FUNDING' });
    rememberForexAccountKind(LIVE, 'LIVE');

    const blocked = await orders.place(LIVE, {
      clientOrderId: 'live-blocked',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    assert.equal(blocked.status, 'REJECTED');
    assert.equal(blocked.failureReason, 'LIVE_BROKER_UNAVAILABLE');
    assert.equal(counted.calls(), 0);

    useBroker(readyFetch());
    const pending = await orders.place(LIVE, {
      clientOrderId: 'live-limit',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'limit',
      volume: '0.10',
      requestedPrice: '1.20000',
    });
    assert.equal(pending.status, 'PENDING', pending.failureReason ?? 'limit');
    const mockQuote = pricing.getQuote('EURUSD');
    assert.ok(mockQuote);
    await orders.evaluateQuote(mockQuote!);
    assert.equal(orders.listOwned(LIVE).find((o) => o.clientOrderId === 'live-limit')?.status, 'PENDING');
    assert.equal(counted.calls(), 0);

    const filled = await orders.place(LIVE, {
      clientOrderId: 'live-mkt',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    assert.equal(filled.status, 'FILLED', filled.failureReason ?? 'live fill');
    assert.equal(filled.source, 'LIVE');
    assert.equal(filled.executionMode, 'BROKER');
    assert.equal(counted.calls(), 0);
    const exec = execution.get(filled.clientExecId);
    assert.equal(exec?.fills[0]?.liquiditySource, 'BROKER');
    assert.equal(exec?.source, 'LIVE');
    assert.equal(fxDecimal(exec!.fills[0]!.price).eq('1.25005'), true);
    const livePos = positions.listOwned(LIVE, true).find((p) => p.symbol === 'EURUSD');
    assert.equal(fxDecimal(livePos!.entryPrice).eq('1.25005'), true);
    assert.equal(fxDecimal(livePos!.currentPrice).eq('1.3'), true);

    rememberForexAccountKind(DEMO, 'DEMO');
    const demo = await orders.place(DEMO, {
      clientOrderId: 'demo-mkt',
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    assert.equal(demo.status, 'FILLED', demo.failureReason ?? 'demo fill');
    assert.equal(demo.source, 'SIMULATED');
    assert.equal(demo.executionMode, 'MOCK');
    assert.equal(counted.calls(), 1);
    assert.equal(fxDecimal(positions.listOwned(DEMO, true)[0]!.entryPrice).eq('1.25005'), false);
  });

  it('reports liveForexReady only when quote, order, account, and cash health all pass', async () => {
    useBroker(readyFetch());
    const ready = await buildLiveForexReadiness();
    assert.equal(ready.liveForexReady, true);
    assert.equal(ready.capabilities.deposit, true);
    assert.equal(ready.capabilities.withdrawal, true);
    assert.equal(ready.realForexEffective, false);
    assert.equal(ready.blockers.includes('Payment provider for Forex deposits not configured'), false);
    assert.equal(ready.blockers.includes('No external broker/LP adapter enabled'), false);
  });
});
