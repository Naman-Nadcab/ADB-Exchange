/**
 * Phase 1A — HEDGING core (independent same-symbol positions).
 * Run: FOREX_SILENT_LOG=1 FOREX_DEMO_FUNDING=true FOREX_DEMO_ZERO_SPREAD=true \
 *   npx tsx src/services/forex/forex-phase1a-hedging.test.ts
 */
import assert from 'node:assert/strict';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexExecutionService } from './execution/service.js';
import { ForexExecutionStore } from './execution/store.js';
import { createMockExecutionVenues } from './execution/venues.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { closeForexPosition } from './orders/close.js';
import { ForexOrderService } from './orders/service.js';
import { ForexOrderStore } from './orders/store.js';
import {
  getAccountPositionMode,
  resetAccountPositionModesForTests,
  setAccountPositionMode,
} from './positions/account-mode.js';
import { applyHedgingOpen, applyHedgingReduce } from './positions/hedging.js';
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
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';

const OPEN_SESSION_CLOCK = new Date('2026-09-07T16:00:00.000Z');
resetForexSessionExceptionsForTests();
setForexSessionNowForTests(OPEN_SESSION_CLOCK);

const NET = 'phase1a-netting';
const HEDGE = 'phase1a-hedging';
const OTHER = 'phase1a-other';

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
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  for (const [id, code] of [
    [FOREX_PROVIDER_IDS.MOCK_A, 'MOCK-A'],
    [FOREX_PROVIDER_IDS.MOCK_B, 'MOCK-B'],
    [FOREX_PROVIDER_IDS.MOCK_C, 'MOCK-C'],
  ] as const) {
    pricing.ingestRaw(raw({ symbol: 'EURUSD', providerId: id, providerCode: code, bid: mid, ask: mid, providerSequence: 1n }), now);
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

async function market(h: ReturnType<typeof harness>, accountId: string, side: 'buy' | 'sell', volume: string, id: string) {
  const order = await h.orders.place(accountId, {
    clientOrderId: id,
    symbol: 'EURUSD',
    side,
    orderType: 'market',
    volume,
  });
  assert.equal(order.status, 'FILLED', `${id}: ${order.failureReason}`);
  return order;
}

function assertInvariants(label: string, view: {
  ledgerBalance: string;
  equity: string;
  unrealizedPnl: string;
  usedMargin: string;
  freeMargin: string;
}) {
  const equity = fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl);
  assert.ok(equity.eq(view.equity), `${label} equity`);
  assert.ok(fxDecimal(view.equity).minus(view.usedMargin).eq(view.freeMargin), `${label} free`);
}

// --- unit: hedging math ---
{
  const open = applyHedgingOpen({ fillId: '1', side: 'buy', volume: '0.10', price: '1.16', timestamp: new Date().toISOString() });
  assert.equal(open.eventType, 'POSITION_OPENED');
  assert.equal(open.after.side, 'long');
  const red = applyHedgingReduce(open.after, {
    fillId: '2',
    side: 'sell',
    volume: '0.04',
    price: '1.17',
    timestamp: new Date().toISOString(),
  });
  assert.equal(red.eventType, 'POSITION_REDUCED');
  assert.equal(red.after.volume, '0.06');
  assert.throws(() =>
    applyHedgingReduce(open.after, {
      fillId: '3',
      side: 'buy',
      volume: '0.01',
      price: '1.16',
      timestamp: new Date().toISOString(),
    })
  );
  console.log('  PASS  hedging math open/reduce');
}

// --- TEST A: NETTING regression ---
{
  const h = harness(NET, 'NETTING');
  await h.acc.credit({ accountId: NET, amount: '10000', idempotencyKey: `fund-${NET}`, type: 'INITIAL_FUNDING' });
  await market(h, NET, 'buy', '0.10', 'net-buy');
  assert.equal(h.positions.listOwned(NET, true).length, 1);
  await market(h, NET, 'sell', '0.10', 'net-sell');
  assert.equal(h.positions.listOwned(NET, true).length, 0, 'NETTING BUY+SELL same volume must flatten');
  assert.equal(getAccountPositionMode(NET), 'NETTING');
  console.log('  PASS  TEST A NETTING regression');
}

// --- TEST B: HEDGING BUY+SELL → 2 positions ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '0.10', 'h-buy');
  assert.equal(h.positions.listOwned(HEDGE, true).length, 1);
  await market(h, HEDGE, 'sell', '0.10', 'h-sell');
  const open = h.positions.listOwned(HEDGE, true);
  assert.equal(open.length, 2, 'HEDGING must keep BUY and SELL open');
  const longs = open.filter((p) => p.side === 'long');
  const shorts = open.filter((p) => p.side === 'short');
  assert.equal(longs.length, 1);
  assert.equal(shorts.length, 1);
  assert.notEqual(longs[0]!.positionId, shorts[0]!.positionId);
  assert.ok(open.every((p) => p.mode === 'HEDGING'));
  console.log('  PASS  TEST B HEDGING two independent positions');
}

// --- same-side independent ---
{
  const h = harness('phase1a-same', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-same', amount: '10000', idempotencyKey: 'fund-same', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-same', 'buy', '0.10', 's1');
  await market(h, 'phase1a-same', 'buy', '0.20', 's2');
  const open = h.positions.listOwned('phase1a-same', true);
  assert.equal(open.length, 2);
  assert.ok(open.every((p) => p.side === 'long'));
  console.log('  PASS  same-side HEDGING creates two positions');
}

// --- MT5 parity case: BUY 1.0 + BUY 0.5 + SELL 0.3 → three positions ---
{
  const acct = 'phase1a-triple';
  const h = harness(acct, 'HEDGING');
  await h.acc.credit({ accountId: acct, amount: '50000', idempotencyKey: 'fund-triple', type: 'INITIAL_FUNDING' });
  await market(h, acct, 'buy', '1.00', 't-b1');
  await market(h, acct, 'buy', '0.50', 't-b2');
  await market(h, acct, 'sell', '0.30', 't-s1');
  const open = h.positions.listOwned(acct, true);
  assert.equal(open.length, 3);
  const longs = open.filter((p) => p.side === 'long');
  const shorts = open.filter((p) => p.side === 'short');
  assert.equal(longs.length, 2);
  assert.equal(shorts.length, 1);
  assert.ok(new Set(open.map((p) => p.positionId)).size === 3);
  console.log('  PASS  HEDGING three independent EURUSD positions (1.0 / 0.5 / 0.3)');
}

// --- TEST C: independent close ---
{
  const h = harness('phase1a-close', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-close', amount: '10000', idempotencyKey: 'fund-close', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-close', 'buy', '0.10', 'c-buy');
  await market(h, 'phase1a-close', 'sell', '0.10', 'c-sell');
  const [buy, sell] = (() => {
    const o = h.positions.listOwned('phase1a-close', true);
    return [o.find((p) => p.side === 'long')!, o.find((p) => p.side === 'short')!];
  })();
  await closeForexPosition('phase1a-close', { positionId: buy.positionId, clientOrderId: 'c-close-buy' }, h);
  assert.equal(h.positions.getOwned('phase1a-close', buy.positionId).status, 'CLOSED');
  assert.equal(h.positions.getOwned('phase1a-close', sell.positionId).status, 'OPEN');
  await closeForexPosition('phase1a-close', { positionId: sell.positionId, clientOrderId: 'c-close-sell' }, h);
  assert.equal(h.positions.listOwned('phase1a-close', true).length, 0);
  console.log('  PASS  TEST C independent close');
}

// --- TEST D: partial close ---
{
  const h = harness('phase1a-part', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-part', amount: '10000', idempotencyKey: 'fund-part', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-part', 'buy', '1.00', 'p-buy');
  await market(h, 'phase1a-part', 'sell', '1.00', 'p-sell');
  const buy = h.positions.listOwned('phase1a-part', true).find((p) => p.side === 'long')!;
  const sell = h.positions.listOwned('phase1a-part', true).find((p) => p.side === 'short')!;
  await closeForexPosition(
    'phase1a-part',
    { positionId: buy.positionId, clientOrderId: 'p-part', volume: '0.40' },
    h
  );
  assert.ok(fxDecimal(h.positions.getOwned('phase1a-part', buy.positionId).volume).eq('0.60'));
  assert.ok(fxDecimal(h.positions.getOwned('phase1a-part', sell.positionId).volume).eq('1.00'));
  console.log('  PASS  TEST D partial close isolation');
}

// --- TEST E/F: SL/TP isolation ---
{
  const h = harness('phase1a-prot', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-prot', amount: '10000', idempotencyKey: 'fund-prot', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-prot', 'buy', '0.10', 'prot-buy');
  await market(h, 'phase1a-prot', 'sell', '0.10', 'prot-sell');
  const buy = h.positions.listOwned('phase1a-prot', true).find((p) => p.side === 'long')!;
  const sell = h.positions.listOwned('phase1a-prot', true).find((p) => p.side === 'short')!;
  const mid = Number(h.pricing.getQuote('EURUSD')!.bid);
  const sl = await h.protections.create('phase1a-prot', {
    clientProtectionId: 'sl-buy',
    positionId: buy.positionId,
    type: 'STOP_LOSS',
    triggerPrice: (mid - 0.01).toFixed(5),
  });
  assert.equal(sl.status, 'ACTIVE');
  const q0 = h.pricing.getQuote('EURUSD')!;
  const fire = {
    ...q0,
    bid: (mid - 0.02).toFixed(5),
    ask: (mid - 0.02).toFixed(5),
    mid: (mid - 0.02).toFixed(5),
    edaReceiveSequence: `${q0.edaReceiveSequence}-sl`,
    freshness: 'FRESH' as const,
    quality: 'OK' as const,
    status: 'TRADEABLE' as const,
  };
  await h.protections.evaluateQuote(fire);
  assert.equal(h.protections.getOwned('phase1a-prot', sl.protectionId).status, 'FILLED', 'BUY SL protection must fill');
  assert.equal(h.positions.getOwned('phase1a-prot', buy.positionId).status, 'CLOSED', 'BUY SL must close BUY');
  assert.equal(h.positions.getOwned('phase1a-prot', sell.positionId).status, 'OPEN', 'SELL must survive BUY SL');

  const h2 = harness('phase1a-tp', 'HEDGING');
  await h2.acc.credit({ accountId: 'phase1a-tp', amount: '10000', idempotencyKey: 'fund-tp', type: 'INITIAL_FUNDING' });
  await market(h2, 'phase1a-tp', 'buy', '0.10', 'tp-buy');
  await market(h2, 'phase1a-tp', 'sell', '0.10', 'tp-sell');
  const buy2 = h2.positions.listOwned('phase1a-tp', true).find((p) => p.side === 'long')!;
  const sell2 = h2.positions.listOwned('phase1a-tp', true).find((p) => p.side === 'short')!;
  const mid2 = Number(h2.pricing.getQuote('EURUSD')!.ask);
  const tp = await h2.protections.create('phase1a-tp', {
    clientProtectionId: 'tp-only-sell',
    positionId: sell2.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: (mid2 - 0.01).toFixed(5),
  });
  assert.equal(tp.status, 'ACTIVE');
  const q1 = h2.pricing.getQuote('EURUSD')!;
  const fire2 = {
    ...q1,
    bid: (mid2 - 0.02).toFixed(5),
    ask: (mid2 - 0.02).toFixed(5),
    mid: (mid2 - 0.02).toFixed(5),
    edaReceiveSequence: `${q1.edaReceiveSequence}-tp`,
    freshness: 'FRESH' as const,
    quality: 'OK' as const,
    status: 'TRADEABLE' as const,
  };
  await h2.protections.evaluateQuote(fire2);
  assert.equal(h2.protections.getOwned('phase1a-tp', tp.protectionId).status, 'FILLED', 'SELL TP protection must fill');
  assert.equal(h2.positions.getOwned('phase1a-tp', sell2.positionId).status, 'CLOSED', 'SELL TP must close SELL');
  assert.equal(h2.positions.getOwned('phase1a-tp', buy2.positionId).status, 'OPEN', 'BUY must survive SELL TP');
  console.log('  PASS  TEST E/F SL/TP isolation');
}

// --- TEST G/H: P&L + margin ---
{
  const h = harness('phase1a-pnl', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-pnl', amount: '10000', idempotencyKey: 'fund-pnl', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-pnl', 'buy', '0.10', 'pnl-buy');
  await market(h, 'phase1a-pnl', 'sell', '0.10', 'pnl-sell');
  h.pricing.applyDemoPrice('EURUSD', '1.17000');
  const view = h.acc.accountView('phase1a-pnl');
  const pnl = h.acc.pnlView('phase1a-pnl');
  assert.equal(pnl.positions.length, 2);
  const sum = pnl.positions.reduce((a, p) => a.plus(p.accountPnl ?? '0'), fxDecimal(0));
  assert.ok(sum.eq(view.unrealizedPnl), 'account unrealized must equal sum of positions');
  assertInvariants('hedge-open', view);
  const usedBoth = view.usedMargin;
  assert.ok(fxDecimal(usedBoth).gt(0));

  const buy = h.positions.listOwned('phase1a-pnl', true).find((p) => p.side === 'long')!;
  await closeForexPosition('phase1a-pnl', { positionId: buy.positionId, clientOrderId: 'pnl-close-buy' }, h);
  const afterOne = h.acc.accountView('phase1a-pnl');
  assertInvariants('hedge-one', afterOne);
  assert.ok(fxDecimal(afterOne.usedMargin).lt(usedBoth));

  const sell = h.positions.listOwned('phase1a-pnl', true)[0]!;
  await closeForexPosition('phase1a-pnl', { positionId: sell.positionId, clientOrderId: 'pnl-close-sell' }, h);
  const flat = h.acc.accountView('phase1a-pnl');
  assert.equal(flat.usedMargin, '0');
  assertInvariants('hedge-flat', flat);
  console.log('  PASS  TEST G/H P&L + margin');
}

// --- TEST I: ledger ---
{
  const h = harness('phase1a-led', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-led', amount: '10000', idempotencyKey: 'fund-led', type: 'INITIAL_FUNDING' });
  await market(h, 'phase1a-led', 'buy', '0.10', 'led-buy');
  await market(h, 'phase1a-led', 'sell', '0.10', 'led-sell');
  for (const p of h.positions.listOwned('phase1a-led', true)) {
    await closeForexPosition('phase1a-led', { positionId: p.positionId, clientOrderId: `led-close-${p.positionId.slice(0, 8)}` }, h);
  }
  const rec = h.acc.reconcile('phase1a-led');
  assert.equal(rec.ok, true, rec.reason ?? 'ledger');
  console.log('  PASS  TEST I ledger MATCH');
}

// --- ownership ---
{
  const h = harness(HEDGE, 'HEDGING');
  await h.acc.credit({ accountId: HEDGE, amount: '10000', idempotencyKey: `fund-${HEDGE}-own`, type: 'INITIAL_FUNDING' });
  await market(h, HEDGE, 'buy', '0.10', 'own-buy');
  const pos = h.positions.listOwned(HEDGE, true)[0]!;
  assert.throws(
    () => h.positions.getOwned(OTHER, pos.positionId),
    (e: unknown) => e instanceof ForexPositionError && e.reason === 'POSITION_NOT_FOUND'
  );
  await assert.rejects(
    () => closeForexPosition(OTHER, { positionId: pos.positionId, clientOrderId: 'steal' }, h),
    (e: unknown) => e instanceof ForexPositionError
  );
  console.log('  PASS  ownership / IDOR');
}

// --- TEST J: concurrency ---
{
  const h = harness('phase1a-conc', 'HEDGING');
  await h.acc.credit({ accountId: 'phase1a-conc', amount: '10000', idempotencyKey: 'fund-conc', type: 'INITIAL_FUNDING' });
  await Promise.all([
    market(h, 'phase1a-conc', 'buy', '0.10', 'conc-buy'),
    market(h, 'phase1a-conc', 'sell', '0.10', 'conc-sell'),
  ]);
  const open = h.positions.listOwned('phase1a-conc', true);
  assert.equal(open.length, 2);
  await Promise.all(
    open.map((p, i) =>
      closeForexPosition('phase1a-conc', { positionId: p.positionId, clientOrderId: `conc-close-${i}` }, h)
    )
  );
  assert.equal(h.positions.listOwned('phase1a-conc', true).length, 0);
  // duplicate clientOrderId
  await market(h, 'phase1a-conc', 'buy', '0.05', 'dup-id');
  const dup = await h.orders.place('phase1a-conc', {
    clientOrderId: 'dup-id',
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.05',
  });
  assert.ok(dup.status === 'FILLED' || dup.orderId); // idempotent replay or same order
  assert.equal(h.positions.listOwned('phase1a-conc', true).filter((p) => p.side === 'long').length, 1);
  const rec = h.acc.reconcile('phase1a-conc');
  assert.equal(rec.ok, true, rec.reason ?? 'conc ledger');
  console.log('  PASS  TEST J concurrency');
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('\nforex phase1a hedging: PASS');
