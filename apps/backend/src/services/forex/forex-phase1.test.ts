import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { FOREX_INSTRUMENT_CATALOG, getForexInstrumentBySymbol, listForexSymbols } from './instruments.catalog.js';
import { buildDefaultForexSessionCalendar } from './sessions.catalog.js';
import { calculateMid, calculateSpread } from './market-data/spread.js';
import { validateProviderQuote } from './market-data/validate.js';
import { decideSequence } from './market-data/sequence.js';
import { evaluateStaleness, resolveQuoteQuality } from './market-data/staleness.js';
import { mockPriceAt } from './market-data/mock-provider.js';
import { forexConfig } from './config.js';
import {
  forexInstrumentsPayload,
  forexQuoteBySymbolPayload,
  forexQuotesPayload,
} from './http.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { forexWsHub } from './ws/hub.js';
import { forexWsEnvelope, isForexAccountPrivateChannel, isForexOrderChannel, isPublicForexChannel, isReservedPrivateForexChannel } from './ws/protocol.js';
import type { ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function rawQuote(overrides: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask'>): ProviderRawQuote {
  return {
    providerId: 'f0000000-0000-4000-8000-0000000000a1',
    providerCode: 'MOCK-A',
    providerTimestamp: new Date(),
    providerSequence: 1n,
    source: 'SIMULATED',
    ...overrides,
  };
}

function failReason(result: ReturnType<typeof validateProviderQuote>): string | undefined {
  return result.ok ? undefined : result.reason;
}

function validateOf(symbol: string, bid: string, ask: string, extra: Partial<Parameters<typeof validateProviderQuote>[0]> = {}) {
  const now = extra.receivedTimestamp ?? new Date();
  return validateProviderQuote({
    symbol,
    bid,
    ask,
    providerTimestamp: extra.providerTimestamp ?? now,
    receivedTimestamp: now,
    providerSequence: extra.providerSequence ?? 1n,
    maxFutureSkewMs: forexConfig.maxFutureSkewMs,
    instrument: extra.instrument ?? getForexInstrumentBySymbol(symbol),
  });
}

// ---------- instruments ----------
{
  const symbols = listForexSymbols();
  assert.equal(symbols.length, 12);
  assert.deepEqual(symbols, [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
    'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD',
  ]);
  const uniq = new Set(FOREX_INSTRUMENT_CATALOG.map((i) => i.symbol));
  assert.equal(uniq.size, 12);
  const eurusd = getForexInstrumentBySymbol('EUR/USD');
  assert.ok(eurusd);
  assert.equal(eurusd.digits, 5);
  assert.equal(eurusd.pipSize, '0.0001');
  assert.equal(eurusd.tickSize, '0.00001');
  assert.equal(eurusd.contractSize, '100000');
  assert.equal(eurusd.volumeStep, '0.01');
  const usdjpy = getForexInstrumentBySymbol('USDJPY')!;
  assert.equal(usdjpy.digits, 3);
  assert.equal(usdjpy.pipSize, '0.01');
  assert.equal(usdjpy.contractSize, '100000');
  const xau = getForexInstrumentBySymbol('XAUUSD')!;
  assert.equal(xau.contractSize, '100');
  assert.equal(xau.pipSize, '0.01');
  const xag = getForexInstrumentBySymbol('XAGUSD')!;
  assert.equal(xag.contractSize, '5000');
  for (const i of FOREX_INSTRUMENT_CATALOG) {
    assert.ok(Number(i.volumeStep) > 0);
    assert.ok(Number(i.minVolume) > 0);
    assert.ok(Number(i.maxVolume) >= Number(i.minVolume));
    assert.ok(Number(i.pipSize) > 0);
    assert.ok(Number(i.tickSize) > 0);
  }
}

{
  const cal = buildDefaultForexSessionCalendar();
  assert.equal(cal.timezone, 'UTC');
  const names = new Set(cal.windows.map((w) => w.sessionName));
  assert.deepEqual([...names].sort(), ['London', 'New York', 'Sydney', 'Tokyo']);
  assert.ok(cal.windows.every((w) => w.dayOfWeek >= 0 && w.dayOfWeek <= 4));
}

// ---------- quotes validation ----------
{
  assert.equal(validateOf('EURUSD', '1.08500', '1.08506').ok, true);
  assert.equal(failReason(validateOf('EURUSD', '0', '1.08506')), 'ZERO_BID');
  assert.equal(failReason(validateOf('EURUSD', '1.08500', '0')), 'ZERO_ASK');
  assert.equal(failReason(validateOf('EURUSD', '-1.08500', '1.08506')), 'NEGATIVE_BID');
  assert.equal(failReason(validateOf('EURUSD', '1.08500', '-1.08506')), 'NEGATIVE_ASK');
  assert.equal(failReason(validateOf('EURUSD', '1.08510', '1.08500')), 'CROSSED_MARKET');
  assert.equal(failReason(validateOf('NOPE', '1.08500', '1.08506')), 'UNKNOWN_INSTRUMENT');
  assert.equal(failReason(validateOf('EURUSD', '1.085001', '1.08506')), 'IMPOSSIBLE_PRECISION');
  const badTs = validateProviderQuote({
    symbol: 'EURUSD',
    bid: '1.08500',
    ask: '1.08506',
    providerTimestamp: new Date('not-a-date'),
    receivedTimestamp: new Date(),
    providerSequence: 1n,
    maxFutureSkewMs: 2000,
    instrument: getForexInstrumentBySymbol('EURUSD'),
  });
  assert.equal(badTs.ok, false);
  assert.equal(failReason(badTs), 'INVALID_PROVIDER_TIMESTAMP');
  const future = new Date(Date.now() + 60_000);
  assert.equal(
    failReason(validateOf('EURUSD', '1.08500', '1.08506', { providerTimestamp: future, receivedTimestamp: new Date() })),
    'FUTURE_PROVIDER_TIMESTAMP'
  );
  assert.equal(failReason(validateOf('EURUSD', '1.08500', '1.08506', { providerSequence: -1n })), 'MALFORMED_SEQUENCE');
}

// ---------- spread / pip / mid ----------
{
  const eurusd = getForexInstrumentBySymbol('EURUSD')!;
  const usdjpy = getForexInstrumentBySymbol('USDJPY')!;
  const xau = getForexInstrumentBySymbol('XAUUSD')!;
  const s1 = calculateSpread('1.08500', '1.08506', eurusd);
  assert.equal(s1.spread.toFixed(5), '0.00006');
  assert.equal(s1.spreadPips.toFixed(1), '0.6');
  assert.equal(s1.spreadTicks.toFixed(0), '6');
  const s2 = calculateSpread('149.500', '149.506', usdjpy);
  assert.equal(s2.spreadPips.toFixed(1), '0.6');
  const s3 = calculateSpread('2320.50', '2320.70', xau);
  assert.equal(s3.spread.toFixed(2), '0.20');
  assert.equal(s3.spreadPips.toFixed(0), '20');
  assert.equal(calculateMid('1.08500', '1.08506').toFixed(5), '1.08503');
}

// ---------- freshness ----------
{
  const received = new Date('2026-09-01T10:00:00.000Z');
  const provider = new Date('2026-09-01T10:00:00.000Z');
  const staleMs = 2000;
  const boundary = evaluateStaleness({
    providerTimestamp: provider,
    receivedTimestamp: received,
    now: new Date(received.getTime() + staleMs),
    staleMs,
    providerStaleMs: 3000,
  });
  assert.equal(boundary.freshness, 'FRESH');
  const over = evaluateStaleness({
    providerTimestamp: provider,
    receivedTimestamp: received,
    now: new Date(received.getTime() + staleMs + 1),
    staleMs,
    providerStaleMs: 3000,
  });
  assert.equal(over.freshness, 'STALE');
  const providerOld = evaluateStaleness({
    providerTimestamp: new Date(received.getTime() - 4000),
    receivedTimestamp: received,
    now: received,
    staleMs,
    providerStaleMs: 3000,
  });
  assert.equal(providerOld.freshness, 'STALE');
  assert.equal(resolveQuoteQuality({ source: 'SIMULATED', freshness: 'FRESH', halted: false, crossed: false }), 'SIMULATED');
  assert.equal(resolveQuoteQuality({ source: 'SIMULATED', freshness: 'STALE', halted: false, crossed: false }), 'STALE');
  assert.equal(resolveQuoteQuality({ source: 'LIVE', freshness: 'FRESH', halted: false, crossed: false }), 'OK');
  assert.equal(resolveQuoteQuality({ source: 'LIVE', freshness: 'FRESH', halted: true, crossed: false }), 'HALTED');
}

// ---------- sequence ----------
{
  assert.equal(decideSequence(undefined, 1n).action, 'accept');
  assert.equal(decideSequence(1n, 2n).action, 'accept');
  assert.equal(decideSequence(5n, 5n).action, 'duplicate');
  assert.equal(decideSequence(5n, 4n).action, 'out_of_order');
  assert.equal(decideSequence(5n, 10n).action, 'accept');
}

// ---------- provider / deterministic / health ----------
{
  const a = mockPriceAt('EURUSD', 7n, 0);
  const b = mockPriceAt('EURUSD', 7n, 0);
  assert.deepEqual(a, b);
  assert.notEqual(a.bid, a.ask);
  const svc = resetForexPricingServiceForTests();
  svc.startPrimary(['EURUSD']);
  const first = svc.tick(new Date())[0];
  assert.ok(first);
  assert.equal(first.source, 'SIMULATED');
  assert.notEqual(first.source, 'LIVE');
  assert.equal(first.providerCode, 'MOCK-A');
  assert.ok(['SIMULATED', 'STALE'].includes(first.quality));
  const health = svc.listHealth().find((h) => h.providerCode === 'MOCK-A');
  assert.ok(health);
  assert.equal(health.quoteCount > 0, true);
  assert.ok(['HEALTHY', 'DEGRADED', 'STALE', 'OFFLINE'].includes(health.status));
  const again = mockPriceAt('EURUSD', 7n, 0);
  assert.deepEqual(again, a);
}

// ---------- ingest reject / sequence through service ----------
{
  const svc = resetForexPricingServiceForTests();
  const now = new Date();
  const accepted = svc.ingestRaw(rawQuote({ symbol: 'EURUSD', bid: '1.08500', ask: '1.08506', providerSequence: 10n }), now);
  assert.ok(accepted);
  assert.equal(accepted.source, 'SIMULATED');
  const dup = svc.ingestRaw(rawQuote({ symbol: 'EURUSD', bid: '1.08600', ask: '1.08606', providerSequence: 10n }), now);
  assert.ok(dup);
  assert.equal(dup.bid, accepted.bid);
  const ooo = svc.ingestRaw(rawQuote({ symbol: 'EURUSD', bid: '1.09000', ask: '1.09006', providerSequence: 9n }), now);
  assert.equal(ooo, null);
  assert.equal(svc.getQuote('EURUSD')?.bid, accepted.bid);
  const rejected = svc.ingestRaw(rawQuote({ symbol: 'EURUSD', bid: '0', ask: '1.08506', providerSequence: 11n }), now);
  assert.equal(rejected, null);
}

// ---------- REST ----------
{
  const svc = resetForexPricingServiceForTests();
  svc.startPrimary();
  svc.tick(new Date());
  const app = Fastify();
  app.get('/api/v1/forex/instruments', async () => forexInstrumentsPayload());
  app.get('/api/v1/forex/quotes', async () => forexQuotesPayload(svc));
  app.get('/api/v1/forex/quotes/:symbol', async (req, reply) => {
    const result = forexQuoteBySymbolPayload(svc, (req.params as { symbol: string }).symbol);
    return reply.status(result.status).send(result.body);
  });
  await app.ready();
  const inst = await app.inject({ method: 'GET', url: '/api/v1/forex/instruments' });
  assert.equal(inst.statusCode, 200);
  const instBody = inst.json();
  assert.equal(instBody.success, true);
  assert.equal(instBody.data.count, 12);
  const all = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes' });
  const allBody = all.json();
  assert.equal(allBody.data.source, 'SIMULATED');
  assert.equal(allBody.data.count, 12);
  assert.ok(allBody.data.quotes.every((q: { source: string }) => q.source === 'SIMULATED'));
  const one = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes/EURUSD' });
  assert.equal(one.statusCode, 200);
  const oneBody = one.json();
  assert.equal(oneBody.data.source, 'SIMULATED');
  assert.notEqual(oneBody.data.source, 'LIVE');
  assert.equal(oneBody.data.quote.symbol, 'EURUSD');
  const slash = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes/EUR%2FUSD' });
  assert.equal(slash.statusCode, 200);
  const missing = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes/BTCUSDT' });
  assert.equal(missing.statusCode, 404);
  await app.close();
}

// ---------- WebSocket ----------
{
  const svc = resetForexPricingServiceForTests();
  svc.startPrimary(['EURUSD']);
  svc.tick(new Date());
  const app = Fastify();
  await app.register(websocket);
  app.get('/api/v1/forex/ws', { websocket: true }, (socket) => {
    const id = forexWsHub.register(socket as unknown as WebSocket);
    socket.send(forexWsEnvelope('welcome', undefined, { source: 'SIMULATED' }));
    socket.on('close', () => forexWsHub.unregister(id));
    socket.on('message', (buf: Buffer) => {
      const msg = JSON.parse(buf.toString()) as { type?: string; channel?: string };
      if (msg.type === 'subscribe' && msg.channel && isPublicForexChannel(msg.channel)) {
        forexWsHub.subscribe(id, msg.channel);
        socket.send(forexWsEnvelope('subscribed', msg.channel, { ok: true }));
        const q = svc.getQuote('EURUSD');
        if (q) socket.send(forexWsEnvelope('fx.quote', 'fx.quote.EURUSD', q));
      }
    });
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const events: Array<{ type: string; data?: { source?: string; symbol?: string } }> = [];
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/forex/ws`);
    const timer = setTimeout(() => reject(new Error('ws timeout')), 4000);
    ws.on('message', (buf) => {
      const msg = JSON.parse(buf.toString()) as { type: string; data?: { source?: string; symbol?: string } };
      events.push(msg);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.quote.EURUSD' }));
      }
      if (msg.type === 'fx.quote') {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
  });
  await app.close();
  assert.ok(events.some((e) => e.type === 'subscribed'));
  const quoteEv = events.find((e) => e.type === 'fx.quote');
  assert.ok(quoteEv);
  assert.equal(quoteEv.data?.source, 'SIMULATED');
  assert.equal(quoteEv.data?.symbol, 'EURUSD');
  assert.equal(isForexOrderChannel('fx.order.x'), true);
  assert.equal(isReservedPrivateForexChannel('fx.copy.x'), true);
  assert.equal(isReservedPrivateForexChannel('fx.liquidation.x'), false);
  assert.equal(isReservedPrivateForexChannel('fx.pnl.x'), false);
  assert.equal(isForexAccountPrivateChannel('fx.liquidation'), true);
  assert.equal(isForexAccountPrivateChannel('fx.protection'), true);
  assert.equal(isForexAccountPrivateChannel('fx.exposure'), true);
  assert.equal(isForexAccountPrivateChannel('fx.dealing'), true);
  assert.equal(isForexAccountPrivateChannel('fx.restriction'), true);
  assert.equal(isPublicForexChannel('orderbook:BTC_USDT'), false);
}

// ---------- isolation ----------
{
  const forexFiles = [
    'routes/forex.fastify.ts',
    'services/forex/quotes.service.ts',
    'services/forex/market-data/persist.ts',
    'services/forex/http.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of forexFiles) {
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('matching-engine'), false);
    assert.equal(src.includes('/api/v1/spot/ws'), false);
  }
  assert.equal(isPublicForexChannel('ticker:BTC_USDT'), false);
}

{
  const targets = [
    'http://127.0.0.1:4000/api/v1/spot/markets',
    'http://127.0.0.1/api/v1/spot/markets',
  ];
  let isolated = false;
  for (const url of targets) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        isolated = true;
        break;
      }
    } catch {
      /* live backend optional for unit pass */
    }
  }
  if (!isolated) {
    console.log('forex-phase1 isolation live-check: spot API not reachable from test process (source isolation still asserted)');
  } else {
    console.log('forex-phase1 isolation live-check: existing Spot /markets still responds');
  }
}

console.log('forex-phase1.test: ok');
