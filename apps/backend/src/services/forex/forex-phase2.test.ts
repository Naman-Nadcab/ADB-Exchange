import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { Decimal } from '../../lib/decimal.js';
import { FOREX_PROVIDER_IDS, getForexInstrumentBySymbol } from './instruments.catalog.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { mockPriceAt } from './market-data/mock-provider.js';
import { forexLiquidityBySymbolPayload, forexLiquidityPayload, forexProvidersPayload } from './http.js';
import { MockForexExecutionVenue } from './execution/mock-venue.js';
import { forexWsHub } from './ws/hub.js';
import { forexWsEnvelope, isPublicForexChannel } from './ws/protocol.js';
import type { NormalizedQuote, ProviderRawQuote } from './types.js';
import { calculateMid, calculateSpread } from './market-data/spread.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function raw(partial: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>): ProviderRawQuote {
  return {
    providerTimestamp: new Date(),
    providerSequence: 1n,
    source: 'SIMULATED',
    ...partial,
  };
}

function makeNormalized(args: {
  providerId: string;
  providerCode: string;
  symbol?: string;
  bid: string;
  ask: string;
  received: Date;
  providerTs?: Date;
  seq?: bigint;
  eda?: bigint;
}): NormalizedQuote {
  const symbol = args.symbol ?? 'EURUSD';
  const instrument = getForexInstrumentBySymbol(symbol)!;
  const bid = new Decimal(args.bid);
  const ask = new Decimal(args.ask);
  const spread = calculateSpread(bid, ask, instrument);
  return {
    symbol,
    instrumentId: instrument.id,
    bid,
    ask,
    mid: calculateMid(bid, ask),
    spread: spread.spread,
    spreadPips: spread.spreadPips,
    spreadTicks: spread.spreadTicks,
    providerId: args.providerId,
    providerCode: args.providerCode,
    providerTimestamp: args.providerTs ?? args.received,
    receivedTimestamp: args.received,
    providerSequence: args.seq ?? 1n,
    edaReceiveSequence: args.eda ?? 1n,
    quality: ask.lt(bid) ? 'CROSSED' : 'SIMULATED',
    status: ask.lt(bid) ? 'REJECTED' : 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
  };
}

// A. Three providers publish independently
{
  const a = mockPriceAt('EURUSD', 3n, 0);
  const b = mockPriceAt('EURUSD', 3n, 1);
  const c = mockPriceAt('EURUSD', 3n, 2);
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(b, c);
  assert.notDeepEqual(a, c);
  const svc = resetForexPricingServiceForTests();
  svc.startAll(['EURUSD']);
  svc.tick(new Date());
  const book = svc.aggregator.getAggregatedBook('EURUSD');
  assert.equal(book.quotes.length, 3);
  const codes = new Set(book.quotes.map((q) => q.providerCode));
  assert.deepEqual([...codes].sort(), ['MOCK-A', 'MOCK-B', 'MOCK-C']);
}

// B + C. Best bid / best ask
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }), now);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  assert.equal(book.bestBid, '1.16621');
  assert.equal(book.bestBidProviderCode, 'MOCK-B');
  assert.equal(book.bestAsk, '1.16622');
  assert.equal(book.bestAskProviderCode, 'MOCK-C');
  assert.equal(book.status, 'READY');
  const snap = svc.getRoutingSnapshot('EURUSD', now);
  assert.equal(snap.bestBidProvider, 'MOCK-B');
  assert.equal(snap.bestAskProvider, 'MOCK-C');
  assert.equal(snap.status, 'READY');
  assert.equal(snap.source, 'SIMULATED');
}

// D. Stale provider excluded
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  const staleRecv = new Date(now.getTime() - 10_000);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.20000', ask: '1.20003', providerSequence: 1n, providerTimestamp: staleRecv }), staleRecv);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  const a = book.eligibility.find((e) => e.providerCode === 'MOCK-A');
  assert.equal(a?.eligible, false);
  assert.equal(a?.reason, 'QUOTE_STALE');
  assert.ok(!book.eligibleProviderIds.includes(FOREX_PROVIDER_IDS.MOCK_A));
  assert.equal(book.bestBidProviderCode, 'MOCK-B');
}

// E. Crossed provider excluded
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  svc.aggregator.ingest(
    makeNormalized({
      providerId: FOREX_PROVIDER_IDS.MOCK_A,
      providerCode: 'MOCK-A',
      bid: '1.16630',
      ask: '1.16620',
      received: now,
    })
  );
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 2n }), now);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  assert.equal(book.eligibility.find((e) => e.providerCode === 'MOCK-A')?.reason, 'QUOTE_CROSSED');
  assert.equal(book.bestBidProviderCode, 'MOCK-B');
}

// F. Excessive spread excluded
{
  const svc = resetForexPricingServiceForTests();
  const rule = svc.aggregator.rules.get(FOREX_PROVIDER_IDS.MOCK_C, null)!;
  svc.aggregator.rules.upsert({ ...rule, maxSpread: '0.00010' });
  const now = new Date();
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16600', ask: '1.16700', providerSequence: 1n }), now);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  assert.equal(book.eligibility.find((e) => e.providerCode === 'MOCK-C')?.reason, 'SPREAD_LIMIT');
}

// G. Excessive latency excluded
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  const oldTs = new Date(now.getTime() - 900);
  svc.ingestRaw(
    raw({
      symbol: 'EURUSD',
      providerId: FOREX_PROVIDER_IDS.MOCK_A,
      providerCode: 'MOCK-A',
      bid: '1.16620',
      ask: '1.16623',
      providerSequence: 1n,
      providerTimestamp: oldTs,
    }),
    now
  );
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  assert.equal(book.eligibility.find((e) => e.providerCode === 'MOCK-A')?.reason, 'LATENCY_LIMIT');
  assert.equal(book.bestBidProviderCode, 'MOCK-B');
}

// H. Excessive reject-rate excluded
{
  const svc = resetForexPricingServiceForTests();
  for (let i = 0; i < 10; i += 1) svc.health.recordRejected(FOREX_PROVIDER_IDS.MOCK_A);
  const now = new Date();
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  const healthA = svc.health.snapshot(FOREX_PROVIDER_IDS.MOCK_A, now)!;
  assert.ok(healthA.rejectRate > 0.05);
  const book = svc.aggregator.getAggregatedBook('EURUSD', now);
  assert.equal(book.eligibility.find((e) => e.providerCode === 'MOCK-A')?.reason, 'REJECT_RATE_LIMIT');
}

// I. Primary failover
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  const staleRecv = new Date(now.getTime() - 8000);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n, providerTimestamp: staleRecv }), staleRecv);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  const snap = svc.getRoutingSnapshot('EURUSD', now);
  assert.equal(snap.selectedProvider, 'MOCK-B');
  assert.equal(snap.selectedReason, 'FAILOVER');
  const decision = svc.decideExecution({ symbol: 'EURUSD', side: 'buy', volume: '1.00', now });
  assert.equal(decision.selectedProvider, 'MOCK-B');
  assert.ok(decision.routingReason === 'FAILOVER' || decision.routingReason === 'BEST_ASK');
}

// J. No eligible provider → NO_LIQUIDITY
{
  const svc = resetForexPricingServiceForTests();
  svc.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_A);
  svc.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  svc.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const snap = svc.getRoutingSnapshot('EURUSD', new Date());
  assert.equal(snap.status, 'NO_LIQUIDITY');
  assert.equal(snap.selectedProvider, null);
  assert.equal(snap.bestBid, null);
}

// K. Routing snapshot deterministic
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date('2026-09-01T12:00:00.000Z');
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 5n, providerTimestamp: now }), now);
  svc.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 5n, providerTimestamp: now }), now);
  const one = svc.getRoutingSnapshot('EURUSD', now);
  const two = svc.getRoutingSnapshot('EURUSD', now);
  assert.equal(one.bestBid, two.bestBid);
  assert.equal(one.bestAsk, two.bestAsk);
  assert.equal(one.bestBidProvider, two.bestBidProvider);
  assert.equal(one.status, two.status);
}

// L M N O. Mock execution — accept / reject / partial / no financial writes
{
  const venue = new MockForexExecutionVenue();
  const ok = await venue.placeOrder({ clientExecId: 'ok-1', symbol: 'EURUSD', side: 'buy', volume: '1.00', price: '1.16622' });
  assert.equal(ok.status, 'accepted');
  assert.equal(ok.filledVolume, '1');
  const rej = await venue.placeOrder({ clientExecId: 'REJECT-me', symbol: 'EURUSD', side: 'buy', volume: '1.00' });
  assert.equal(rej.status, 'rejected');
  assert.equal(rej.filledVolume, '0');
  const part = await venue.placeOrder({ clientExecId: 'PARTIAL-1', symbol: 'EURUSD', side: 'sell', volume: '2.00', price: '1.16620' });
  assert.equal(part.status, 'partial');
  assert.equal(part.filledVolume, '1');
  const src = readFileSync(path.join(backendRoot, 'services/forex/execution/mock-venue.ts'), 'utf8');
  assert.equal(src.includes('forex_positions'), false);
  assert.equal(src.includes('forex_ledger'), false);
  assert.equal(src.includes('user_balances'), false);
  assert.equal(src.includes('spot_trades'), false);
  assert.equal(src.includes('settlement_events'), false);
}

// REST liquidity / providers
{
  const svc = resetForexPricingServiceForTests();
  svc.startAll(['EURUSD']);
  svc.tick(new Date());
  const app = Fastify();
  app.get('/api/v1/forex/providers', async () => forexProvidersPayload(svc));
  app.get('/api/v1/forex/liquidity', async () => forexLiquidityPayload(svc));
  app.get('/api/v1/forex/liquidity/:symbol', async (req, reply) => {
    const result = forexLiquidityBySymbolPayload(svc, (req.params as { symbol: string }).symbol);
    return reply.status(result.status).send(result.body);
  });
  await app.ready();
  const providers = (await app.inject({ url: '/api/v1/forex/providers' })).json();
  assert.equal(providers.data.count, 3);
  assert.equal(providers.data.source, 'SIMULATED');
  const liq = (await app.inject({ url: '/api/v1/forex/liquidity/EURUSD' })).json();
  assert.equal(liq.success, true);
  assert.ok(['READY', 'DEGRADED'].includes(liq.data.status));
  assert.ok(liq.data.providers.length >= 3);
  await app.close();
}

// P. Forex WS still works (quote + liquidity)
{
  const svc = resetForexPricingServiceForTests();
  svc.startAll(['EURUSD']);
  svc.tick(new Date());
  const app = Fastify();
  await app.register(websocket);
  app.get('/api/v1/forex/ws', { websocket: true }, (socket) => {
    const id = forexWsHub.register(socket as unknown as WebSocket);
    socket.send(forexWsEnvelope('welcome', undefined, { events: ['fx.quote', 'fx.liquidity'] }));
    socket.on('close', () => forexWsHub.unregister(id));
    socket.on('message', (buf: Buffer) => {
      const msg = JSON.parse(buf.toString()) as { type?: string; channel?: string };
      if (msg.type === 'subscribe' && msg.channel && isPublicForexChannel(msg.channel)) {
        forexWsHub.subscribe(id, msg.channel);
        socket.send(forexWsEnvelope('subscribed', msg.channel, { ok: true }));
        if (msg.channel.startsWith('fx.liquidity')) {
          socket.send(forexWsEnvelope('fx.liquidity', 'fx.liquidity.EURUSD', svc.getRoutingSnapshot('EURUSD')));
        } else {
          const q = svc.getQuote('EURUSD');
          if (q) socket.send(forexWsEnvelope('fx.quote', 'fx.quote.EURUSD', q));
        }
      }
    });
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const seen = new Set<string>();
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/forex/ws`);
    const timer = setTimeout(() => reject(new Error('ws timeout')), 4000);
    ws.on('message', (buf) => {
      const msg = JSON.parse(buf.toString()) as { type: string };
      seen.add(msg.type);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.quote.EURUSD' }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.liquidity.EURUSD' }));
      }
      if (seen.has('fx.quote') && seen.has('fx.liquidity')) {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
  });
  await app.close();
  assert.ok(seen.has('fx.quote'));
  assert.ok(seen.has('fx.liquidity'));
}

// Q/S source isolation
{
  const files = [
    'services/forex/liquidity/book.ts',
    'services/forex/liquidity/eligibility.ts',
    'services/forex/execution/mock-venue.ts',
    'services/forex/execution/venue.ts',
    'routes/forex.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('matching-engine'), false);
    assert.equal(src.includes('/api/v1/spot/ws'), false);
  }
}

{
  let spotOk = false;
  for (const url of ['http://127.0.0.1:4000/api/v1/spot/markets', 'http://127.0.0.1/api/v1/spot/markets']) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        spotOk = true;
        break;
      }
    } catch {
      /* optional */
    }
  }
  console.log(spotOk ? 'forex-phase2 isolation: Spot /markets still 200' : 'forex-phase2 isolation: live Spot probe skipped');
}

console.log('forex-phase2.test: ok');
