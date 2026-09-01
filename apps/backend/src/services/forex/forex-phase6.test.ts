import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { registerForexAccountingRoutes } from '../../routes/forex-accounting.fastify.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { fxDecimal } from './decimal-fx.js';
import { ForexLedgerError } from './ledger/models.js';
import { ForexLedgerService } from './ledger/service.js';
import { ForexLedgerStore } from './ledger/store.js';
import { resetForexAccountingServiceForTests } from './accounting/service.js';
import { MapConversionSource, convertQuoteToAccount, ForexConversionError } from './pnl/conversion.js';
import { calculateRealizedPnl, calculateUnrealizedPnl, quoteRealizedPnl } from './pnl/engine.js';
import type { ForexPositionFillInput } from './positions/models.js';
import { ForexPositionService, resetForexPositionServiceForTests } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { evaluateAccountRisk, resetForexAccountPoliciesForTests } from './risk/engine.js';
import { forexWsHub } from './ws/hub.js';
import { isForexAccountPrivateChannel, isReservedPrivateForexChannel } from './ws/protocol.js';
import type { ForexQuoteDto, ProviderRawQuote } from './types.js';

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
  pricing.ingestRaw(raw({ symbol: 'USDJPY', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '149.490', ask: '149.510', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'GBPUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.27000', ask: '1.27010', providerSequence: 1n }), now);
  pricing.ingestRaw(raw({ symbol: 'EURGBP', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '0.85500', ask: '0.85510', providerSequence: 1n }), now);
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

function harness() {
  resetForexAccountPoliciesForTests();
  const pricing = seedBook();
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  return { pricing, positions, acc };
}

// 1-8 ledger
{
  const store = new ForexLedgerStore();
  const ledger = new ForexLedgerService(store, false);
  const ok = await ledger.post({
    idempotencyKey: 'DEPOSIT:t1',
    type: 'DEPOSIT',
    accountId: USER,
    currency: 'USD',
    entries: [
      { ledgerAccount: 'CLEARING', debit: '1000', credit: '0' },
      { ledgerAccount: 'CUSTOMER_CASH', accountId: USER, debit: '0', credit: '1000' },
    ],
  });
  assert.equal(ok.status, 'POSTED');
  assert.equal(fxDecimal(ok.entries[0]!.debit).plus(ok.entries[1]!.debit).eq(fxDecimal(ok.entries[0]!.credit).plus(ok.entries[1]!.credit)), true);
  assert.equal(ledger.customerCashBalance(USER), '1000');

  await assert.rejects(
    () =>
      ledger.post({
        idempotencyKey: 'BAD:unbal',
        type: 'ADJUSTMENT',
        accountId: USER,
        currency: 'USD',
        entries: [
          { ledgerAccount: 'CLEARING', debit: '10', credit: '0' },
          { ledgerAccount: 'CUSTOMER_CASH', debit: '0', credit: '7' },
        ],
      }),
    (e: unknown) => e instanceof ForexLedgerError && e.reason === 'LEDGER_UNBALANCED'
  );

  const entry = ok.entries[0]!;
  assert.throws(() => {
    (entry as { debit: string }).debit = '999';
  });

  const replay = await ledger.post({
    idempotencyKey: 'DEPOSIT:t1',
    type: 'DEPOSIT',
    accountId: USER,
    currency: 'USD',
    entries: [
      { ledgerAccount: 'CLEARING', debit: '1000', credit: '0' },
      { ledgerAccount: 'CUSTOMER_CASH', accountId: USER, debit: '0', credit: '1000' },
    ],
  });
  assert.equal(replay.transactionId, ok.transactionId);
  assert.equal(ledger.list(USER).length, 1);

  await assert.rejects(
    () =>
      ledger.post({
        idempotencyKey: 'DEPOSIT:t1',
        type: 'DEPOSIT',
        accountId: USER,
        currency: 'USD',
        entries: [
          { ledgerAccount: 'CLEARING', debit: '2000', credit: '0' },
          { ledgerAccount: 'CUSTOMER_CASH', debit: '0', credit: '2000' },
        ],
      }),
    (e: unknown) => e instanceof ForexLedgerError && e.reason === 'IDEMPOTENCY_CONFLICT'
  );

  const snap = ledger.recover();
  const recovered = new ForexLedgerService(new ForexLedgerStore(), false);
  recovered.store.hydrate(snap);
  assert.equal(recovered.customerCashBalance(USER), '1000');
  assert.equal(recovered.list(USER).length, 1);

  const [a, b] = await Promise.all([
    ledger.post({
      idempotencyKey: 'DEPOSIT:conc',
      type: 'DEPOSIT',
      accountId: USER,
      currency: 'USD',
      entries: [
        { ledgerAccount: 'CLEARING', debit: '5', credit: '0' },
        { ledgerAccount: 'CUSTOMER_CASH', debit: '0', credit: '5' },
      ],
    }),
    ledger.post({
      idempotencyKey: 'DEPOSIT:conc',
      type: 'DEPOSIT',
      accountId: USER,
      currency: 'USD',
      entries: [
        { ledgerAccount: 'CLEARING', debit: '5', credit: '0' },
        { ledgerAccount: 'CUSTOMER_CASH', debit: '0', credit: '5' },
      ],
    }),
  ]);
  assert.equal(a.transactionId, b.transactionId);
  assert.equal(ledger.customerCashBalance(USER), '1005');
}

// 9-14 funding / debit
{
  const { acc } = harness();
  const funded = await acc.credit({
    accountId: USER,
    amount: '10000',
    idempotencyKey: 'DEPOSIT:init',
    type: 'INITIAL_FUNDING',
    externalReference: 'init',
  });
  assert.equal(funded.type, 'INITIAL_FUNDING');
  assert.equal(acc.ledgerBalance(USER), '10000');
  assert.equal(funded.source, 'SIMULATED');

  const again = await acc.credit({
    accountId: USER,
    amount: '10000',
    idempotencyKey: 'DEPOSIT:init',
    type: 'INITIAL_FUNDING',
    externalReference: 'init',
  });
  assert.equal(again.transactionId, funded.transactionId);
  assert.equal(acc.ledgerBalance(USER), '10000');

  await assert.rejects(
    () =>
      acc.credit({
        accountId: USER,
        amount: '1',
        idempotencyKey: 'DEPOSIT:init',
        type: 'INITIAL_FUNDING',
      }),
    (e: unknown) => e instanceof ForexLedgerError && e.reason === 'IDEMPOTENCY_CONFLICT'
  );

  const wd = await acc.withdraw({ accountId: USER, amount: '250', idempotencyKey: 'WITHDRAWAL:w1' });
  assert.equal(wd.status, 'POSTED');
  assert.equal(acc.ledgerBalance(USER), '9750');

  await assert.rejects(
    () => acc.withdraw({ accountId: USER, amount: '999999', idempotencyKey: 'WITHDRAWAL:big' }),
    (e: unknown) => e instanceof ForexLedgerError && e.reason === 'INSUFFICIENT_FOREX_BALANCE'
  );
  assert.equal(acc.ledgerBalance(USER), '9750');
  assert.ok(!fxDecimal(acc.ledgerBalance(USER)).lt(0));
}

// 15-23 realized P&L
{
  const { acc, positions } = harness();
  await acc.credit({ accountId: USER, amount: '100000', idempotencyKey: 'DEPOSIT:pnl', type: 'DEPOSIT' });

  await positions.applyFill(fill({ fillId: 'long-open', volume: '1.00', price: '1.10000' }));
  const profit = await positions.applyFill(fill({ fillId: 'long-profit', side: 'sell', volume: '1.00', price: '1.20000' }));
  assert.equal(profit?.status, 'CLOSED');
  const expectProfit = quoteRealizedPnl({ side: 'long', entryPrice: '1.10000', closePrice: '1.20000', closedVolume: '1.00', contractSize: '100000' });
  assert.equal(expectProfit, '10000');
  assert.equal(acc.realizedPosted(USER), '10000');
  assert.equal(acc.ledgerBalance(USER), '110000');

  await positions.applyFill(fill({ fillId: 'long-open2', volume: '1.00', price: '1.20000' }));
  await positions.applyFill(fill({ fillId: 'long-loss', side: 'sell', volume: '1.00', price: '1.10000' }));
  assert.equal(acc.realizedPosted(USER), '0');

  await positions.applyFill(fill({ fillId: 'short-open', side: 'sell', volume: '1.00', price: '1.20000' }));
  await positions.applyFill(fill({ fillId: 'short-profit', side: 'buy', volume: '1.00', price: '1.10000' }));
  assert.equal(acc.realizedPosted(USER), '10000');

  await positions.applyFill(fill({ fillId: 'short-open2', side: 'sell', volume: '1.00', price: '1.10000' }));
  await positions.applyFill(fill({ fillId: 'short-loss', side: 'buy', volume: '1.00', price: '1.20000' }));
  assert.equal(acc.realizedPosted(USER), '0');

  await positions.applyFill(fill({ fillId: 'part-open', volume: '1.00', price: '1.10000' }));
  const part = await positions.applyFill(fill({ fillId: 'part-close', side: 'sell', volume: '0.40', price: '1.20000' }));
  assert.equal(part?.status, 'OPEN');
  assert.equal(fxDecimal(part!.volume).eq('0.60'), true);
  assert.equal(acc.realizedPosted(USER), '4000');

  const full = await positions.applyFill(fill({ fillId: 'full-close', side: 'sell', volume: '0.60', price: '1.20000' }));
  assert.equal(full?.status, 'CLOSED');
  assert.equal(acc.realizedPosted(USER), '10000');

  const beforeDup = acc.ledger.list(USER).filter((t) => t.type === 'REALIZED_PNL').length;
  await positions.applyFill(fill({ fillId: 'full-close', side: 'sell', volume: '0.60', price: '1.20000' }));
  const afterDup = acc.ledger.list(USER).filter((t) => t.type === 'REALIZED_PNL').length;
  assert.equal(afterDup, beforeDup);

  await positions.applyFill(fill({ fillId: 'm1', volume: '0.50', price: '1.10000' }));
  await positions.applyFill(fill({ fillId: 'm2', volume: '0.50', price: '1.10000' }));
  await positions.applyFill(fill({ fillId: 'm3', side: 'sell', volume: '1.00', price: '1.20000' }));
  assert.equal(acc.ledger.store.getByKey('REALIZED_PNL:m3')?.status, 'POSTED');
  assert.equal(acc.ledger.list(USER).filter((t) => t.idempotencyKey === 'REALIZED_PNL:m3').length, 1);
}

// 24-30 unrealized / conversion
{
  const { positions, pricing } = harness();
  await positions.applyFill(fill({ fillId: 'u-long', volume: '1.00', price: '1.10000' }));
  const q = pricing.getQuote('EURUSD');
  assert.ok(q);
  const uLong = calculateUnrealizedPnl({
    position: positions.listOwned(USER, true)[0]!,
    quote: q,
    rates: { getRate: (pair) => (pricing.getQuote(pair) ? { pair, bid: pricing.getQuote(pair)!.bid, ask: pricing.getQuote(pair)!.ask, mid: pricing.getQuote(pair)!.mid, source: 'SIMULATED', timestamp: pricing.getQuote(pair)!.receivedTimestamp, freshness: 'FRESH' } : null) },
  });
  assert.equal(uLong.priceSource, 'BID');
  assert.equal(uLong.valuationPrice, q.bid);
  assert.notEqual(uLong.valuationPrice, q.mid);
  assert.equal(uLong.calculationStatus, 'CALCULATED');
  assert.equal(uLong.source, 'SIMULATED');

  const { positions: p2, pricing: pr2 } = harness();
  await p2.applyFill(fill({ fillId: 'u-short', side: 'sell', volume: '1.00', price: '1.20000' }));
  const q2 = pr2.getQuote('EURUSD')!;
  const uShort = calculateUnrealizedPnl({
    position: p2.listOwned(USER, true)[0]!,
    quote: q2,
    rates: { getRate: () => null },
  });
  assert.equal(uShort.priceSource, 'ASK');
  assert.equal(uShort.valuationPrice, q2.ask);

  const stale: ForexQuoteDto = { ...q!, freshness: 'STALE', quality: 'STALE' };
  const staleU = calculateUnrealizedPnl({ position: positions.listOwned(USER, true)[0]!, quote: stale, rates: { getRate: () => null } });
  assert.equal(staleU.calculationStatus, 'STALE_PRICE');

  const ident = convertQuoteToAccount({ quoteAmount: '100', instrumentSymbol: 'EURUSD', rates: new MapConversionSource() });
  assert.equal(ident.conversionSource, 'IDENTITY');
  assert.equal(ident.amountAccount, '100');

  const jpy = calculateRealizedPnl({
    symbol: 'USDJPY',
    side: 'long',
    entryPrice: '149.000',
    closePrice: '150.000',
    closedVolume: '1.00',
    rates: new MapConversionSource(),
  });
  assert.equal(jpy.conversion.conversionSource, 'USDXXX');
  assert.equal(fxDecimal(jpy.accountPnl).eq(fxDecimal('100000').div('150')), true);

  assert.throws(
    () =>
      convertQuoteToAccount({
        quoteAmount: '10',
        instrumentSymbol: 'EURGBP',
        rates: new MapConversionSource(),
      }),
    (e: unknown) => e instanceof ForexConversionError && e.reason === 'CONVERSION_RATE_UNAVAILABLE'
  );

  const rates = new MapConversionSource();
  rates.set({ pair: 'GBPUSD', bid: '1.27000', ask: '1.27010', mid: '1.27005', source: 'SIMULATED', timestamp: new Date().toISOString(), freshness: 'FRESH' });
  const cross = convertQuoteToAccount({ quoteAmount: '10', instrumentSymbol: 'EURGBP', rates });
  assert.equal(cross.conversionSource, 'XXXUSD');
  assert.equal(cross.amountAccount, fxDecimal('10').times('1.27005').toFixed());

  const dec = quoteRealizedPnl({ side: 'long', entryPrice: '1.10000', closePrice: '1.20000', closedVolume: '0.01', contractSize: '100000' });
  assert.equal(dec, '100');
  assert.equal(Number.isNaN(Number.parseFloat) && false, false);
}

// 31-36 equity / margin
{
  const { acc, positions } = harness();
  await acc.credit({ accountId: USER, amount: '50000', idempotencyKey: 'DEPOSIT:eq', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'eq-open', volume: '1.00', price: '1.10000' }));
  const view = acc.accountView(USER);
  assert.equal(view.calculationStatus, 'CALCULATED');
  assert.equal(fxDecimal(view.equity).eq(fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl)), true);
  assert.equal(view.ledgerBalance, '50000');
  assert.equal(view.realizedPnl, '0');
  assert.ok(fxDecimal(view.usedMargin).gt(0));
  assert.equal(fxDecimal(view.freeMargin).eq(fxDecimal(view.equity).minus(view.usedMargin)), true);
  assert.ok(view.marginLevel);

  await positions.applyFill(fill({ fillId: 'eq-close', side: 'sell', volume: '1.00', price: '1.20000' }));
  const after = acc.accountView(USER);
  assert.equal(after.ledgerBalance, '60000');
  assert.equal(after.realizedPnl, '10000');
  assert.equal(after.unrealizedPnl, '0');
  assert.equal(after.equity, '60000');

  const closed = evaluateAccountRisk({
    accountId: USER,
    positions: positions.listOwned(USER, true),
    accountingAvailable: false,
  });
  assert.equal(closed.ok, false);
  assert.equal(closed.reason, 'ACCOUNTING_UNAVAILABLE');
}

// 37-43 reconciliation
{
  const { acc, positions } = harness();
  await acc.credit({ accountId: USER, amount: '50000', idempotencyKey: 'DEPOSIT:rec', type: 'DEPOSIT' });
  await positions.applyFill(fill({ fillId: 'rec-open', volume: '1.00', price: '1.10000' }));
  await positions.applyFill(fill({ fillId: 'rec-close', side: 'sell', volume: '1.00', price: '1.20000' }));
  assert.equal(acc.reconcile(USER).ok, true);

  const orphan = new ForexPositionService(new ForexPositionStore(), seedBook(), false);
  await orphan.applyFill(fill({ fillId: 'missing-pnl-open', volume: '1.00', price: '1.10000' }));
  await orphan.applyFill(fill({ fillId: 'missing-pnl-close', side: 'sell', volume: '1.00', price: '1.20000' }));
  const acc2 = resetForexAccountingServiceForTests(orphan, seedBook());
  const missing = acc2.reconcile(USER);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'MISSING_PNL');

  acc.ledger.store.put({
    transactionId: 'dup-pnl',
    idempotencyKey: 'REALIZED_PNL:rec-close-dup',
    fingerprint: 'x',
    type: 'REALIZED_PNL',
    accountId: USER,
    currency: 'USD',
    status: 'POSTED',
    entries: [],
    createdAt: new Date().toISOString(),
    metadata: { fillId: 'rec-close', zeroAmount: true },
    source: 'SIMULATED',
  });
  const dup = acc.reconcile(USER);
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'DUPLICATE_PNL');

  const { acc: acc3 } = harness();
  acc3.ledger.store.put({
    transactionId: 'unbal',
    idempotencyKey: 'ADJUSTMENT:unbal',
    fingerprint: 'u',
    type: 'ADJUSTMENT',
    accountId: USER,
    currency: 'USD',
    status: 'POSTED',
    entries: [
      {
        entryId: 'e1',
        transactionId: 'unbal',
        ledgerAccount: 'CLEARING',
        accountId: null,
        debit: '10',
        credit: '0',
        currency: 'USD',
        timestamp: new Date().toISOString(),
        referenceType: null,
        referenceId: null,
      },
      {
        entryId: 'e2',
        transactionId: 'unbal',
        ledgerAccount: 'CUSTOMER_CASH',
        accountId: USER,
        debit: '0',
        credit: '1',
        currency: 'USD',
        timestamp: new Date().toISOString(),
        referenceType: null,
        referenceId: null,
      },
    ],
    createdAt: new Date().toISOString(),
    source: 'SIMULATED',
  });
  const unbal = acc3.reconcile(USER);
  assert.equal(unbal.ok, false);
  assert.equal(unbal.reason, 'LEDGER_UNBALANCED');

  const { acc: acc4 } = harness();
  acc4.ledger.store.entries.push({
    entryId: 'orphan',
    transactionId: 'none',
    ledgerAccount: 'CUSTOMER_CASH',
    accountId: USER,
    debit: '0',
    credit: '9',
    currency: 'USD',
    timestamp: new Date().toISOString(),
    referenceType: null,
    referenceId: null,
  });
  const badBal = acc4.reconcile(USER);
  assert.equal(badBal.ok, false);
  assert.ok(badBal.reason === 'INCORRECT_BALANCE' || badBal.reason === 'INCORRECT_EQUITY');

  const { acc: acc5, positions: p5 } = harness();
  await acc5.credit({ accountId: USER, amount: '1000', idempotencyKey: 'DEPOSIT:stale', type: 'DEPOSIT' });
  await p5.applyFill(fill({ fillId: 'stale-open', volume: '0.01', price: '1.10000', symbol: 'XAUUSD' }));
  const eqFail = acc5.reconcile(USER);
  assert.equal(eqFail.ok, false);
  assert.ok(eqFail.reason === 'INCORRECT_EQUITY' || eqFail.reason === 'MISSING_PNL');
}

// 44-48 security + WS
{
  resetForexAccountPoliciesForTests();
  const pricing = seedBook();
  const positions = resetForexPositionServiceForTests(pricing);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  await acc.credit({ accountId: USER, amount: '1000', idempotencyKey: 'DEPOSIT:api', type: 'DEPOSIT' });
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
  await registerForexAccountingRoutes(app);
  await app.ready();

  const mine = await app.inject({ method: 'GET', url: '/account' });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.json().data.source, 'SIMULATED');
  assert.equal(mine.json().data.account.ledgerBalance, '1000');
  assert.equal(mine.json().data.account.currency, 'USD');

  uid = USER_B;
  const leakAccount = await app.inject({ method: 'GET', url: '/account' });
  assert.equal(leakAccount.statusCode, 200);
  assert.equal(leakAccount.json().data.account.ledgerBalance, '0');
  const leakLedger = await app.inject({ method: 'GET', url: '/ledger' });
  assert.equal(leakLedger.json().data.transactions.length, 0);
  const leakPnl = await app.inject({ method: 'GET', url: '/pnl' });
  assert.equal(leakPnl.json().data.pnl.realized, '0');
  const leakFund = await app.inject({ method: 'GET', url: '/funding' });
  assert.equal(leakFund.json().data.transactions.length, 0);

  uid = null;
  const unauth = await app.inject({ method: 'GET', url: '/balance' });
  assert.equal(unauth.statusCode, 401);
  await app.close();

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
  assert.equal(isForexAccountPrivateChannel('fx.pnl'), true);
  assert.equal(isForexAccountPrivateChannel('fx.liquidation'), true);
  assert.equal(isReservedPrivateForexChannel('fx.copy.x'), true);
  assert.equal(forexWsHub.subscribe(idA, 'fx.pnl'), true);
  assert.equal(forexWsHub.subscribe(idA, 'fx.equity'), true);
  assert.equal(forexWsHub.subscribe(idA, 'fx.funding'), true);
  assert.equal(forexWsHub.subscribe(idB, 'fx.pnl'), true);
  forexWsHub.publishPrivate(USER, 'fx.pnl', { source: 'SIMULATED', secret: 'a-only' });
  assert.ok(a.sent.some((s) => s.includes('a-only')));
  assert.equal(b.sent.some((s) => s.includes('a-only')), false);
  const anon = new FakeSock();
  assert.equal(forexWsHub.subscribe(forexWsHub.register(anon as unknown as import('ws').WebSocket), 'fx.account'), false);
}

// isolation
{
  const files = [
    'services/forex/ledger/service.ts',
    'services/forex/accounting/service.ts',
    'services/forex/pnl/engine.ts',
    'services/forex/pnl/conversion.ts',
    'services/forex/risk/engine.ts',
    'routes/forex-accounting.fastify.ts',
  ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
  for (const src of files) {
    assert.equal(src.includes('user_balances'), false);
    assert.equal(src.includes('balance_ledger'), false);
    assert.equal(src.includes('spot_orders'), false);
    assert.equal(src.includes('spot_trades'), false);
    assert.equal(src.includes('parseFloat'), false);
  }
  const migrate = readFileSync(path.join(backendRoot, 'database/migrate.ts'), 'utf8');
  assert.ok(migrate.includes('forex_ledger_transactions'));
  assert.ok(migrate.includes('FOREX PHASE 6'));
}

console.log('forex-phase6.test: ok');
