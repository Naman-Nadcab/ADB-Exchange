import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues, asMock } from './execution/venues.js';
import { ForexExecutionError } from './execution/models.js';
import type { ForexExecutionRequest } from './execution/request.js';
import { assertTransition, canTransition } from './execution/states.js';
import type { ProviderRawQuote } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function raw(p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook(pricing = resetForexPricingServiceForTests(), now = new Date()) {
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }), now);
  return pricing;
}

function req(overrides: Partial<ForexExecutionRequest> = {}): ForexExecutionRequest {
  return {
    clientExecId: overrides.clientExecId ?? `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    symbol: 'EURUSD',
    side: 'buy',
    volume: '1.00',
    orderType: 'market',
    timestamp: new Date().toISOString(),
    maxSlippage: '0.01000',
    maxDeviation: '0.01000',
    ...overrides,
  };
}

function svc(pricing = seedBook()) {
  const venues = createMockExecutionVenues();
  const store = new ForexExecutionStore();
  return { pricing, venues, store, exec: new ForexExecutionService(pricing, venues, store, false) };
}

// 1 valid
{
  const { exec } = svc();
  const r = await exec.execute(req({ clientExecId: 'ok-1' }));
  assert.equal(r.status, 'FILLED');
  assert.equal(r.source, 'SIMULATED');
  assert.ok(r.fills.length >= 1);
  assert.equal(r.remainingVolume, '0');
}

// 2-5 invalid
{
  const { exec } = svc();
  const badSymbol = await exec.execute(req({ clientExecId: 'bad-sym', symbol: 'BTCUSDT' }));
  assert.equal(badSymbol.status, 'REJECTED');
  assert.equal(badSymbol.failureReason, 'UNKNOWN_INSTRUMENT');
  const badSide = await exec.execute(req({ clientExecId: 'bad-side', side: 'hold' as 'buy' }));
  assert.equal(badSide.failureReason, 'INVALID_SIDE');
  const badVol = await exec.execute(req({ clientExecId: 'bad-vol', volume: '0' }));
  assert.equal(badVol.failureReason, 'INVALID_VOLUME');
  const badStep = await exec.execute(req({ clientExecId: 'bad-step', volume: '0.015' }));
  assert.equal(badStep.failureReason, 'INVALID_VOLUME_STEP');
  const badPrec = await exec.execute(req({ clientExecId: 'bad-prec', volume: '1.000000001' }));
  assert.equal(badPrec.failureReason, 'INVALID_VOLUME_PRECISION');
}

// 6-9 quotes
{
  const { exec } = svc();
  const fresh = await exec.execute(req({ clientExecId: 'fresh-1' }));
  assert.equal(fresh.status, 'FILLED');

  const pricing = resetForexPricingServiceForTests();
  const staleAt = new Date(Date.now() - 10_000);
  pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n, providerTimestamp: staleAt }), staleAt);
  const staleExec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const stale = await staleExec.execute(req({ clientExecId: 'stale-1' }));
  assert.ok(stale.failureReason === 'NO_LIQUIDITY' || stale.failureReason === 'QUOTE_STALE' || stale.status === 'REJECTED');

  const crossedP = resetForexPricingServiceForTests();
  const now = new Date();
  crossedP.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  crossedP.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const missing = await new ForexExecutionService(crossedP, createMockExecutionVenues(), new ForexExecutionStore(), false).execute(req({ clientExecId: 'missing-q' }));
  assert.equal(missing.failureReason, 'NO_LIQUIDITY');

  const crossedOnly = resetForexPricingServiceForTests();
  crossedOnly.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  crossedOnly.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  crossedOnly.ingestRaw(raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16624', ask: '1.16620', providerSequence: 2n }), now);
  const crossed = await new ForexExecutionService(crossedOnly, createMockExecutionVenues(), new ForexExecutionStore(), false).execute(req({ clientExecId: 'crossed-q' }));
  assert.ok(crossed.failureReason === 'NO_LIQUIDITY' || crossed.failureReason === 'QUOTE_CROSSED');
}

// 10-11 deviation
{
  const { exec } = svc();
  const okDev = await exec.execute(req({ clientExecId: 'dev-ok', orderType: 'limit', requestedPrice: '1.16622', maxDeviation: '0.01000' }));
  assert.equal(okDev.status, 'FILLED');
  const badDev = await exec.execute(req({ clientExecId: 'dev-bad', orderType: 'limit', requestedPrice: '1.20000', maxDeviation: '0.00010' }));
  assert.equal(badDev.failureReason, 'PRICE_DEVIATION_LIMIT');
}

// 12-13 slippage
{
  const { exec, venues } = svc();
  asMock(venues.get('MOCK-C'))?.setFillPrice('1.16622');
  const okSlip = await exec.execute(req({ clientExecId: 'slip-ok', maxSlippage: '0.01000' }));
  assert.equal(okSlip.status, 'FILLED');
  const { exec: exec2, venues: v2 } = svc();
  asMock(v2.get('MOCK-A'))?.setFillPrice('1.18000');
  asMock(v2.get('MOCK-B'))?.setFillPrice('1.18000');
  asMock(v2.get('MOCK-C'))?.setFillPrice('1.18000');
  const badSlip = await exec2.execute(req({ clientExecId: 'slip-bad', maxSlippage: '0.00001' }));
  assert.equal(badSlip.failureReason, 'SLIPPAGE_LIMIT');
}

// 14-15 routing
{
  const { exec } = svc();
  const r = await exec.execute(req({ clientExecId: 'route-1', side: 'buy' }));
  assert.ok(r.selectedProvider);
  assert.ok(['MOCK-A', 'MOCK-B', 'MOCK-C'].includes(r.selectedProvider));

  const pricing = seedBook();
  pricing.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const skip = await new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false).execute(req({ clientExecId: 'skip-c', side: 'buy' }));
  assert.notEqual(skip.selectedProvider, 'MOCK-C');
  assert.ok(skip.selectedProvider === 'MOCK-A' || skip.selectedProvider === 'MOCK-B');
}

// 16-19 failover / all reject / no liq
{
  const { exec, venues } = svc();
  asMock(venues.get('MOCK-A'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  const fo = await exec.execute(req({ clientExecId: 'fail-over' }));
  assert.equal(fo.status, 'FILLED');
  assert.ok(fo.attempts.some((a) => a.provider === 'MOCK-A' && a.status === 'REJECT'));
  assert.ok(fo.attempts.some((a) => a.status === 'ACK'));
  assert.ok(fo.events.some((e) => e.eventType === 'FAILOVER'));

  const { exec: allR, venues: va } = svc();
  asMock(va.get('MOCK-A'))?.setForceReject(true);
  asMock(va.get('MOCK-B'))?.setForceReject(true);
  asMock(va.get('MOCK-C'))?.setForceReject(true);
  const all = await allR.execute(req({ clientExecId: 'all-rej' }));
  assert.equal(all.status, 'REJECTED');
  assert.equal(all.failureReason, 'ALL_VENUES_REJECTED');

  const p = resetForexPricingServiceForTests();
  p.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_A);
  p.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  p.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const nl = await new ForexExecutionService(p, createMockExecutionVenues(), new ForexExecutionStore(), false).execute(req({ clientExecId: 'no-liq' }));
  assert.equal(nl.failureReason, 'NO_LIQUIDITY');
}

// 20-21 idempotency
{
  const { exec } = svc();
  const first = await exec.execute(req({ clientExecId: 'idem-1', volume: '1.00' }));
  const second = await exec.execute(req({ clientExecId: 'idem-1', volume: '1.00' }));
  assert.equal(first.executionId, second.executionId);
  assert.equal(first.fills.length, second.fills.length);
  let conflict = false;
  try {
    await exec.execute(req({ clientExecId: 'idem-1', volume: '2.00' }));
  } catch (e) {
    conflict = e instanceof ForexExecutionError && e.reason === 'IDEMPOTENCY_CONFLICT';
  }
  assert.equal(conflict, true);
}

// 22-25 fills
{
  const { exec } = svc();
  const full = await exec.execute(req({ clientExecId: 'fill-full' }));
  assert.equal(full.status, 'FILLED');
  const sum = full.fills.reduce((a, f) => a + Number(f.volume), 0);
  assert.ok(sum <= 1.0000001);

  const { exec: pexec, venues } = svc();
  asMock(venues.get('MOCK-A'))?.setFillPlan(['0.40', '0.60']);
  asMock(venues.get('MOCK-B'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  const multi = await pexec.execute(req({ clientExecId: 'PARTIAL-multi', volume: '1.00' }));
  assert.equal(multi.status, 'FILLED');
  assert.ok(multi.fills.length >= 2);
  const tot = multi.fills.reduce((a, f) => a + Number(f.volume), 0);
  assert.ok(tot <= 1.0000001);

  const { exec: ov, venues: vo } = svc();
  asMock(vo.get('MOCK-A'))?.setFillPlan(['2.00']);
  asMock(vo.get('MOCK-B'))?.setForceReject(true);
  asMock(vo.get('MOCK-C'))?.setForceReject(true);
  const over = await ov.execute(req({ clientExecId: 'over-1', volume: '1.00' }));
  assert.equal(over.status, 'FAILED');
  assert.equal(over.failureReason, 'OVERFILL');
}

// 26-27 state machine
{
  assert.equal(canTransition('RECEIVED', 'VALIDATING'), true);
  assert.equal(canTransition('VALIDATING', 'ROUTING'), true);
  assert.equal(canTransition('FILLED', 'RECEIVED'), false);
  let threw = false;
  try {
    assertTransition('FILLED', 'SUBMITTED');
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
}

// 28 timeout
{
  const { exec, venues, pricing } = svc();
  asMock(venues.get('MOCK-A'))?.setHangMs(4000);
  asMock(venues.get('MOCK-B'))?.setForceReject(true);
  asMock(venues.get('MOCK-C'))?.setForceReject(true);
  pricing.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_B);
  pricing.aggregator.rules.disable(FOREX_PROVIDER_IDS.MOCK_C);
  const t0 = Date.now();
  const timed = await exec.execute(req({ clientExecId: 'to-1' }));
  assert.ok(Date.now() - t0 < 3500);
  assert.equal(timed.status, 'FAILED');
  assert.equal(timed.failureReason, 'VENUE_TIMEOUT');
  assert.ok(timed.events.some((e) => e.eventType === 'VENUE_TIMEOUT'));
}

// 29 recovery — no double submit
{
  const { exec, store } = svc();
  const first = await exec.execute(req({ clientExecId: 'rec-1' }));
  const store2 = new ForexExecutionStore();
  store2.hydrate(store.snapshot());
  const pricing2 = seedBook();
  const exec2 = new ForexExecutionService(pricing2, createMockExecutionVenues(), store2, false);
  const replay = await exec2.execute(req({ clientExecId: 'rec-1', volume: '1.00' }));
  assert.equal(replay.executionId, first.executionId);
  assert.equal(replay.attempts.length, first.attempts.length);
  const open = exec2.recoverOpen();
  assert.ok(Array.isArray(open));

  const inflight = first;
  const submitted: typeof first = {
    ...JSON.parse(JSON.stringify(inflight)),
    status: 'SUBMITTED',
    executionId: '11111111-1111-4111-8111-111111111111',
    clientExecId: 'rec-open',
    fingerprint: 'EURUSD|buy|1.00|market|',
    request: { ...inflight.request, clientExecId: 'rec-open' },
  };
  const store3 = new ForexExecutionStore();
  store3.hydrate([submitted]);
  const exec3 = new ForexExecutionService(seedBook(), createMockExecutionVenues(), store3, false);
  const recovered = await exec3.execute(req({ clientExecId: 'rec-open', volume: '1.00' }));
  assert.equal(recovered.executionId, submitted.executionId);
  assert.equal(recovered.attempts.length, submitted.attempts.length);
  assert.equal(exec3.recoverOpen().length, 1);
}

// 30 audit trail
{
  const { exec } = svc();
  const r = await exec.execute(req({ clientExecId: 'audit-1' }));
  const types = r.events.map((e) => e.eventType);
  assert.ok(types.includes('EXECUTION_RECEIVED'));
  assert.ok(types.includes('VALIDATION_STARTED'));
  assert.ok(types.includes('ROUTING_SELECTED'));
  assert.ok(types.includes('VENUE_SUBMITTED'));
  assert.ok(types.includes('FILL_RECEIVED'));
  assert.ok(types.includes('EXECUTION_COMPLETED'));
  assert.equal(new Set(r.events.map((e) => e.eventId)).size, r.events.length);
}

// 31 isolation
{
  const files = [
    'services/forex/execution/service.ts',
    'services/forex/execution/persist.ts',
    'services/forex/execution/pretrade.ts',
    'routes/forex.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('/api/v1/spot/ws'), false);
  }
}

console.log('forex-phase3.test: ok');
