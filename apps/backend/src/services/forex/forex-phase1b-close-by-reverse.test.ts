/**
 * Phase 1B — Close By + Atomic Reverse.
 * Run: FOREX_SILENT_LOG=1 FOREX_DEMO_FUNDING=true FOREX_DEMO_ZERO_SPREAD=true \
 *   npx tsx src/services/forex/forex-phase1b-close-by-reverse.test.ts
 */
import assert from 'node:assert/strict';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { closeByForexPositions, matchCloseByVolume, resetCloseByCacheForTests } from './orders/close-by.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import { reverseForexPosition, resetReverseCacheForTests } from './orders/reverse.js';
import {
  getAccountPositionMode,
  resetAccountPositionModesForTests,
  setAccountPositionMode,
} from './positions/account-mode.js';
import { ForexPositionError } from './positions/models.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { ForexProtectionService } from './protection/service.js';
import { ForexProtectionStore } from './protection/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { resetForexDealingForTests } from './risk/dealing.js';
import { resetForexAccountPoliciesForTests } from './risk/engine.js';
import { resetForexRiskLimitsForTests } from './risk/policy.js';
import type { ProviderRawQuote } from './types.js';

const HEDGE = 'phase1b-hedge';
const NET = 'phase1b-net';
const OTHER = 'phase1b-other';

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seed(mid = '1.16000') {
  resetForexAccountPoliciesForTests();
  resetForexRiskLimitsForTests();
  resetForexDealingForTests();
  resetAccountPositionModesForTests();
  resetCloseByCacheForTests();
  resetReverseCacheForTests();
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  for (const [id, code] of [
    [FOREX_PROVIDER_IDS.MOCK_A, 'MOCK-A'],
    [FOREX_PROVIDER_IDS.MOCK_B, 'MOCK-B'],
    [FOREX_PROVIDER_IDS.MOCK_C, 'MOCK-C'],
  ] as const) {
    pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: id, providerCode: code, bid: mid, ask: mid, providerSequence: 1n }), now);
    pricing.ingestRaw(raw({ symbol: 'GBPUSD', providerId: id, providerCode: code, bid: '1.27000', ask: '1.27000', providerSequence: 1n }), now);
  }
  return pricing;
}

function harness(accountId: string, mode: 'NETTING' | 'HEDGING' = 'NETTING') {
  const pricing = seed();
  setAccountPositionMode(accountId, mode);
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  const exec = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  const orders = new ForexOrderService(exec, new ForexOrderStore(), false, positions, pricing);
  const protections = new ForexProtectionService(new ForexProtectionStore(), positions, orders, pricing, false);
  positions.attachProtection(protections);
  return { pricing, positions, acc, orders, protections };
}

async function market(
  h: ReturnType<typeof harness>,
  accountId: string,
  side: 'buy' | 'sell',
  volume: string,
  id: string,
  symbol = 'EURUSD'
) {
  const order = await h.orders.place(accountId, {
    clientOrderId: id,
    symbol,
    side,
    orderType: 'market',
    volume,
  });
  assert.equal(order.status, 'FILLED', `${id}: ${order.failureReason}`);
  return order;
}

function assertInvariants(
  label: string,
  view: { ledgerBalance: string; equity: string; unrealizedPnl: string; usedMargin: string; freeMargin: string }
) {
  const equity = fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl);
  assert.ok(equity.eq(view.equity), `${label} equity`);
  assert.ok(fxDecimal(view.equity).minus(view.usedMargin).eq(view.freeMargin), `${label} free`);
}

// --- unit: match volume ---
{
  assert.equal(matchCloseByVolume('1.00', '0.60'), '0.6');
  assert.equal(matchCloseByVolume('0.40', '1.00'), '0.4');
  assert.equal(matchCloseByVolume('1.00', '1.00'), '1');
  assert.equal(matchCloseByVolume('1.00', '0.60', '0.50'), '0.5');
  assert.throws(() => matchCloseByVolume('1.00', '0.60', '0.70'));
  assert.throws(() => matchCloseByVolume('1.00', '0.60', '0'));
  console.log('  PASS  matchCloseByVolume equal/partial/validation');
}

// --- Close By equal ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-eq`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '1.00', 'cb-eq-buy');
  await market(h, HEDGE, 'sell', '1.00', 'cb-eq-sell');
  const open = h.positions.listOwned(HEDGE, true);
  assert.equal(open.length, 2);
  const long = open.find((p) => p.side === 'long')!;
  const short = open.find((p) => p.side === 'short')!;
  const r = await closeByForexPositions(
    HEDGE,
    { clientCloseById: 'cb-eq', positionIdA: long.positionId, positionIdB: short.positionId },
    h
  );
  assert.equal(r.matchedVolume, '1');
  assert.equal(h.positions.listOwned(HEDGE, true).length, 0);
  const view = h.acc.accountView(HEDGE);
  assertInvariants('cb-eq', view);
  const recon = h.acc.reconcile(HEDGE);
  assert.equal(recon.ok, true, recon.reason ?? 'ledger');
  console.log('  PASS  Close By equal volume → both closed + ledger MATCH');
}

// --- Close By partial ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-part`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '1.00', 'cb-p-buy');
  await market(h, HEDGE, 'sell', '0.60', 'cb-p-sell');
  const open = h.positions.listOwned(HEDGE, true);
  const long = open.find((p) => p.side === 'long')!;
  const short = open.find((p) => p.side === 'short')!;
  await closeByForexPositions(
    HEDGE,
    { clientCloseById: 'cb-part', positionIdA: long.positionId, positionIdB: short.positionId },
    h
  );
  const left = h.positions.listOwned(HEDGE, true);
  assert.equal(left.length, 1);
  assert.equal(left[0]!.side, 'long');
  assert.ok(fxDecimal(left[0]!.volume).eq('0.4'), left[0]!.volume);
  assert.equal(h.acc.reconcile(HEDGE).ok, true);
  console.log('  PASS  Close By partial → BUY 0.40 remains, SELL closed');
}

// --- validations ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-val`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '0.50', 'cb-v-buy');
  await market(h, HEDGE, 'sell', '0.50', 'cb-v-sell');
  await market(h, HEDGE, 'buy', '0.20', 'cb-v-buy2');
  const open = h.positions.listOwned(HEDGE, true);
  const longs = open.filter((p) => p.side === 'long');
  const short = open.find((p) => p.side === 'short')!;

  await assert.rejects(
    () =>
      closeByForexPositions(
        HEDGE,
        { clientCloseById: 'cb-same', positionIdA: longs[0]!.positionId, positionIdB: longs[1]!.positionId },
        h
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'CLOSE_BY_SAME_DIRECTION'
  );

  await market(h, HEDGE, 'buy', '0.10', 'cb-gbp', 'GBPUSD');
  await market(h, HEDGE, 'sell', '0.10', 'cb-gbp-s', 'GBPUSD');
  const gbpBuy = h.positions.listOwned(HEDGE, true).find((p) => p.symbol === 'GBPUSD' && p.side === 'long')!;
  await assert.rejects(
    () =>
      closeByForexPositions(
        HEDGE,
        { clientCloseById: 'cb-sym', positionIdA: longs[0]!.positionId, positionIdB: gbpBuy.positionId },
        h
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'CLOSE_BY_SYMBOL_MISMATCH'
  );

  const hNet = harness(NET, 'NETTING');
  await hNet.acc.credit({ accountId: NET, amount: '10000', idempotencyKey: `fund-${NET}`, type: 'INITIAL_FUNDING' });
  await market(hNet, NET, 'buy', '0.50', 'net-buy');
  const netPos = hNet.positions.listOwned(NET, true)[0]!;
  await assert.rejects(
    () =>
      closeByForexPositions(
        NET,
        { clientCloseById: 'cb-net', positionIdA: netPos.positionId, positionIdB: short.positionId },
        hNet
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'CLOSE_BY_HEDGING_ONLY'
  );

  setAccountPositionMode(OTHER, 'HEDGING');
  await assert.rejects(
    () =>
      closeByForexPositions(
        OTHER,
        { clientCloseById: 'cb-own', positionIdA: longs[0]!.positionId, positionIdB: short.positionId },
        h
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_NOT_FOUND'
  );

  console.log('  PASS  Close By opposite/symbol/HEDGING-only/ownership validation');
}

// --- already closed + idempotency ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-id`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '0.30', 'cb-id-b');
  await market(h, HEDGE, 'sell', '0.30', 'cb-id-s');
  const open = h.positions.listOwned(HEDGE, true);
  const long = open.find((p) => p.side === 'long')!;
  const short = open.find((p) => p.side === 'short')!;
  const first = await closeByForexPositions(
    HEDGE,
    { clientCloseById: 'cb-idem', positionIdA: long.positionId, positionIdB: short.positionId },
    h
  );
  const bal1 = h.acc.accountView(HEDGE).ledgerBalance;
  const second = await closeByForexPositions(
    HEDGE,
    { clientCloseById: 'cb-idem', positionIdA: long.positionId, positionIdB: short.positionId },
    h
  );
  assert.equal(second.matchedVolume, first.matchedVolume);
  assert.equal(h.acc.accountView(HEDGE).ledgerBalance, bal1, 'idempotent Close By must not double-realize');
  assert.equal(h.positions.listOwned(HEDGE, true).length, 0);

  await assert.rejects(
    () =>
      closeByForexPositions(
        HEDGE,
        { clientCloseById: 'cb-closed', positionIdA: long.positionId, positionIdB: short.positionId },
        h
      ),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_CLOSED'
  );
  console.log('  PASS  Close By idempotency + already-closed rejected');
}

// --- HEDGING Reverse BUY → SELL ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-rev`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '1.00', 'rev-buy');
  const pos = h.positions.listOwned(HEDGE, true)[0]!;
  const r = await reverseForexPosition(HEDGE, { positionId: pos.positionId, clientReverseId: 'rev-h1' }, h);
  assert.equal(r.mode, 'HEDGING');
  assert.equal(r.previousSide, 'long');
  assert.equal(r.newSide, 'short');
  const open = h.positions.listOwned(HEDGE, true);
  assert.equal(open.length, 1);
  assert.equal(open[0]!.side, 'short');
  assert.ok(fxDecimal(open[0]!.volume).eq('1'));
  assert.notEqual(open[0]!.positionId, pos.positionId);
  assert.equal(h.acc.reconcile(HEDGE).ok, true);
  console.log('  PASS  HEDGING Reverse BUY → SELL');
}

// --- HEDGING Reverse SELL → BUY ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-rev2`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'sell', '0.50', 'rev-sell');
  const pos = h.positions.listOwned(HEDGE, true)[0]!;
  await reverseForexPosition(HEDGE, { positionId: pos.positionId, clientReverseId: 'rev-h2' }, h);
  const open = h.positions.listOwned(HEDGE, true);
  assert.equal(open.length, 1);
  assert.equal(open[0]!.side, 'long');
  assert.ok(fxDecimal(open[0]!.volume).eq('0.5'));
  console.log('  PASS  HEDGING Reverse SELL → BUY');
}

// --- NETTING Reverse ---
{
  const h = harness(NET, 'NETTING');
  await h.acc.credit({ accountId: NET, amount: '10000', idempotencyKey: `fund-${NET}-rev`, type: 'INITIAL_FUNDING' });
  await market(h, NET, 'buy', '1.00', 'net-rev-buy');
  const pos = h.positions.listOwned(NET, true)[0]!;
  const r = await reverseForexPosition(NET, { positionId: pos.positionId, clientReverseId: 'rev-n1' }, h);
  assert.equal(r.mode, 'NETTING');
  assert.equal(r.newSide, 'short');
  const open = h.positions.listOwned(NET, true);
  assert.equal(open.length, 1);
  assert.equal(open[0]!.side, 'short');
  assert.ok(fxDecimal(open[0]!.volume).eq('1'));
  assert.equal(getAccountPositionMode(NET), 'NETTING');
  assert.equal(h.acc.reconcile(NET).ok, true);
  console.log('  PASS  NETTING Reverse → opposite net position');
}

// --- Reverse idempotency ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-rid`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '0.40', 'rev-id-buy');
  const pos = h.positions.listOwned(HEDGE, true)[0]!;
  await reverseForexPosition(HEDGE, { positionId: pos.positionId, clientReverseId: 'rev-idem' }, h);
  const bal = h.acc.accountView(HEDGE).ledgerBalance;
  const open1 = h.positions.listOwned(HEDGE, true);
  await reverseForexPosition(HEDGE, { positionId: pos.positionId, clientReverseId: 'rev-idem' }, h);
  assert.equal(h.acc.accountView(HEDGE).ledgerBalance, bal);
  assert.equal(h.positions.listOwned(HEDGE, true).length, open1.length);
  console.log('  PASS  Reverse idempotency');
}

console.log('forex phase1b close-by + reverse: PASS');
