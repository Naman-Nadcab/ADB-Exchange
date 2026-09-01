/**
 * Phase 9.6 — tier-0 P1/P2 hardening.
 * Isolated p96-* account ids only. No customer money, real FX, or Crypto tables.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { db } from '../../lib/database.js';
import { FOREX_EQUITY_MODEL } from './accounting/boundary.js';
import { FOREX_VALUATION_POLICY } from './accounting/valuation.js';
import { ForexAccountingService } from './accounting/service.js';
import { FOREX_WRITE_CLASS } from './durability/write-classes.js';
import { FOREX_REPLICA_SAFETY } from './durability/replica-state.js';
import { withForexTransaction } from './durability/tx.js';
import { persistExecution, persistFill } from './execution/persist.js';
import { ForexLedgerService } from './ledger/service.js';
import { ForexLedgerStore } from './ledger/store.js';
import { persistOrder } from './orders/persist.js';
import { canOrderTransition, FOREX_ORDER_TERMINAL } from './orders/states.js';
import { persistAppliedFill } from './positions/persist.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { calculateUnrealizedPnl } from './pnl/engine.js';
import { ForexQuoteConversionSource } from './pnl/conversion.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { evaluateAccountRisk } from './risk/engine.js';
import { calculateLiquidationEligibility } from './liquidation/eligibility.js';
import {
  activeForexSessions,
  holidayCoverage,
  holidayReadiness,
  isForexTradingEligible,
  isForexWeekendClosed,
  resetForexSessionExceptionsForTests,
  setForexHolidayRequiredForTests,
  setForexSessionException,
  setForexSessionNowForTests,
} from './sessions/eligibility.js';
import { zonedCivil } from './sessions/timezone.js';
import type { ForexOrderRecord } from './orders/models.js';
import type { ForexAppliedFill, ForexPositionRecord } from './positions/models.js';
import type { ProviderRawQuote } from './types.js';
import { fxDecimal } from './decimal-fx.js';

const PREFIX = 'p96-';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedSpread(bid: string, ask: string) {
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid, ask, providerSequence: 1n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid, ask, providerSequence: 2n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid, ask, providerSequence: 3n }),
    now
  );
  return pricing;
}

async function ensurePhase96Ddl(): Promise<void> {
  await db.query(`ALTER TABLE forex_executions ALTER COLUMN account_id TYPE VARCHAR(64)`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS forex_holiday_calendar_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      coverage VARCHAR(16) NOT NULL DEFAULT 'UNCONFIGURED',
      required BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.query(`
    INSERT INTO forex_holiday_calendar_state (id, coverage, required)
    VALUES (1, 'UNCONFIGURED', FALSE)
    ON CONFLICT (id) DO NOTHING`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS forex_holiday_dates (
      calendar_date DATE PRIMARY KEY,
      kind VARCHAR(16) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
}

async function cleanup(accountId: string): Promise<void> {
  await db.query(`DELETE FROM forex_position_fills WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_positions WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_pending_orders WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_fills WHERE client_exec_id LIKE $1`, [`%${accountId}%`]);
  await db.query(`DELETE FROM forex_orders WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_executions WHERE account_id = $1`, [accountId]);
  try {
    await db.query(`DELETE FROM forex_ledger_transactions WHERE account_id = $1`, [accountId]);
  } catch {
    /* immutable */
  }
}

function dummyOrder(accountId: string, clientOrderId: string): ForexOrderRecord {
  const now = new Date().toISOString();
  const orderId = randomUUID();
  return {
    orderId,
    clientOrderId,
    clientExecId: `exec-${orderId}`,
    accountId,
    fingerprint: `fp-${clientOrderId}`,
    request: { clientOrderId, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '1' },
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    requestedVolume: '1',
    filledVolume: '1',
    remainingVolume: '0',
    requestedPrice: null,
    maxSlippage: null,
    maxDeviation: null,
    status: 'FILLED',
    failureReason: null,
    executionId: null,
    fillIds: [],
    source: 'SIMULATED',
    executionMode: 'MOCK',
    events: [],
    version: 1,
    lastQuoteKey: null,
    lastModifyKey: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function main(): Promise<void> {
  assert.equal(FOREX_EQUITY_MODEL.equity, 'ledgerBalance + unrealizedPnl');
  assert.equal(FOREX_VALUATION_POLICY.longExecutableClose, 'BID');
  assert.equal(FOREX_VALUATION_POLICY.shortExecutableClose, 'ASK');
  assert.equal(FOREX_VALUATION_POLICY.midNeverDrivesLiquidationEquity, true);
  assert.equal(FOREX_REPLICA_SAFETY.processLocalAuthoritative, false);
  assert.ok(FOREX_WRITE_CLASS.ORDER_LIFECYCLE.includes('forex_orders'));
  assert.ok(FOREX_WRITE_CLASS.AUTHORITATIVE_ECONOMIC.includes('forex_position_fills'));

  const healthy = await db.healthCheck();
  assert.equal(healthy, true, 'PostgreSQL must be reachable for Phase 9.6 tests');
  await ensurePhase96Ddl();

  const accountA = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const accountB = `${PREFIX}${randomUUID().slice(0, 8)}`;
  await cleanup(accountA);
  await cleanup(accountB);

  try {
    // 1. rollback leaves no economic or lifecycle rows
    const order = dummyOrder(accountA, `coid-${randomUUID().slice(0, 8)}`);
    const fillId = randomUUID();
    const execId = randomUUID();
    order.executionId = execId;
    order.fillIds = [fillId];
    await withForexTransaction(async (client) => {
      await persistOrder(order, client);
      await persistExecution(
        {
          executionId: execId,
          clientExecId: order.clientExecId,
          fingerprint: 'fp',
          request: { clientExecId: order.clientExecId, symbol: 'EURUSD', side: 'buy', volume: '1', orderType: 'market', accountId: accountA, timestamp: new Date().toISOString() },
          status: 'FILLED',
          selectedProvider: 'MOCK-A',
          routingReason: null,
          snapshotStatus: null,
          expectedPrice: '1.16620',
          executionPrice: '1.16620',
          requestedVolume: '1',
          filledVolume: '1',
          remainingVolume: '0',
          failureReason: null,
          source: 'SIMULATED',
          attempts: [],
          fills: [],
          events: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        client
      );
      await persistFill(
        {
          fillId,
          executionId: execId,
          clientExecId: order.clientExecId,
          venueExecId: 'v',
          provider: 'MOCK-A',
          symbol: 'EURUSD',
          side: 'buy',
          price: '1.16620',
          volume: '1',
          timestamp: new Date().toISOString(),
          liquiditySource: 'MOCK',
        },
        client
      );
      await persistAppliedFill(
        accountA,
        randomUUID(),
        { fillId, side: 'buy', volume: '1', price: '1.16620', timestamp: new Date().toISOString() },
        client
      );
      throw new Error('FORCE_ROLLBACK');
    }).catch((e: Error) => {
      assert.equal(e.message, 'FORCE_ROLLBACK');
    });
    const rolled = await db.query(
      `SELECT
         (SELECT count(*)::int FROM forex_orders WHERE order_id = $1) AS orders,
         (SELECT count(*)::int FROM forex_executions WHERE execution_id = $2) AS execs,
         (SELECT count(*)::int FROM forex_fills WHERE fill_id = $3) AS fills,
         (SELECT count(*)::int FROM forex_position_fills WHERE fill_id = $3) AS applied`,
      [order.orderId, execId, fillId]
    );
    const counts = rolled.rows[0] as { orders: number; execs: number; fills: number; applied: number };
    assert.equal(counts.orders, 0);
    assert.equal(counts.execs, 0);
    assert.equal(counts.fills, 0);
    assert.equal(counts.applied, 0);

    // 2. committed TX then retry is a no-op (fill uniqueness)
    const committedFill = randomUUID();
    const posId = randomUUID();
    const fill: ForexAppliedFill = {
      fillId: committedFill,
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    };
    const first = await persistAppliedFill(accountA, posId, fill);
    const second = await persistAppliedFill(accountA, posId, fill);
    assert.equal(first, true);
    assert.equal(second, false);

    // 3. two concurrent processes cannot double-book the same fill
    const raceFill = randomUUID();
    const [c1, c2] = await Promise.all([
      persistAppliedFill(accountA, posId, { ...fill, fillId: raceFill }),
      persistAppliedFill(accountA, posId, { ...fill, fillId: raceFill }),
    ]);
    assert.equal(c1 !== c2, true);

    // 4-13 valuation: LONG=BID, SHORT=ASK, mid must not drive equity
    const longPricing = seedSpread('1.10000', '1.30000');
    const longPos: Pick<ForexPositionRecord, 'symbol' | 'side' | 'volume' | 'entryPrice' | 'status'> = {
      symbol: 'EURUSD',
      side: 'long',
      volume: '1',
      entryPrice: '1.20000',
      status: 'OPEN',
    };
    const longWide = calculateUnrealizedPnl({
      position: longPos,
      quote: longPricing.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(longPricing),
    });
    assert.equal(longWide.priceSource, 'BID');
    assert.equal(longWide.calculationStatus, 'CALCULATED');
    const longAskMoved = seedSpread('1.10000', '1.50000');
    const longAskUpl = calculateUnrealizedPnl({
      position: longPos,
      quote: longAskMoved.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(longAskMoved),
    });
    assert.equal(longAskUpl.valuationPrice, longWide.valuationPrice);
    assert.equal(longAskUpl.accountPnl, longWide.accountPnl);
    const longBidMoved = seedSpread('1.00000', '1.50000');
    const longBidUpl = calculateUnrealizedPnl({
      position: longPos,
      quote: longBidMoved.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(longBidMoved),
    });
    assert.equal(longBidUpl.priceSource, 'BID');
    assert.notEqual(longBidUpl.accountPnl, longWide.accountPnl);

    const shortPricing = seedSpread('1.10000', '1.30000');
    const shortPos: Pick<ForexPositionRecord, 'symbol' | 'side' | 'volume' | 'entryPrice' | 'status'> = {
      symbol: 'EURUSD',
      side: 'short',
      volume: '1',
      entryPrice: '1.20000',
      status: 'OPEN',
    };
    const shortWide = calculateUnrealizedPnl({
      position: shortPos,
      quote: shortPricing.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(shortPricing),
    });
    assert.equal(shortWide.priceSource, 'ASK');
    const shortBidMoved = seedSpread('0.90000', '1.30000');
    const shortBidUpl = calculateUnrealizedPnl({
      position: shortPos,
      quote: shortBidMoved.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(shortBidMoved),
    });
    assert.equal(shortBidUpl.valuationPrice, shortWide.valuationPrice);
    const shortAskMoved = seedSpread('0.90000', '1.40000');
    const shortAskUpl = calculateUnrealizedPnl({
      position: shortPos,
      quote: shortAskMoved.getQuote('EURUSD'),
      rates: new ForexQuoteConversionSource(shortAskMoved),
    });
    assert.notEqual(shortAskUpl.accountPnl, shortWide.accountPnl);

    const positions = new ForexPositionService(new ForexPositionStore(), longBidMoved, false);
    const accounting = new ForexAccountingService(
      new ForexLedgerService(new ForexLedgerStore(), false),
      positions,
      new ForexQuoteConversionSource(longBidMoved),
      longBidMoved,
      false
    );
    positions.attachAccounting(accounting);
    accounting.ensureAccount(accountB);
    await accounting.credit({
      accountId: accountB,
      amount: '10000',
      idempotencyKey: `INIT:${accountB}`,
      type: 'INITIAL_FUNDING',
    });
    const opened = await positions.applyFill({
      fillId: randomUUID(),
      accountId: accountB,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '1',
      price: '1.20000',
      timestamp: new Date().toISOString(),
    });
    assert.ok(opened);
    const view = accounting.accountView(accountB);
    assert.equal(view.calculationStatus, 'CALCULATED');
    assert.equal(fxDecimal(view.equity).eq(fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl)), true);
    assert.equal(fxDecimal(view.freeMargin).eq(fxDecimal(view.equity).minus(view.usedMargin)), true);
    assert.equal(view.availableBalance, view.freeMargin);
    const risk = evaluateAccountRisk({
      accountId: accountB,
      positions: positions.listOwned(accountB, true),
      equity: view.equity,
      accountingAvailable: true,
    });
    assert.equal(risk.usedMargin, view.usedMargin);
    assert.equal(risk.freeMargin, view.freeMargin);
    const elig = calculateLiquidationEligibility({
      positions: positions.listOwned(accountB, true),
      equity: view.equity,
      accountingAvailable: true,
    });
    assert.equal(elig.usedMargin, view.usedMargin);
    assert.equal(elig.equity, view.equity);

    // 14. holiday UNCONFIGURED / CONFIGURED OPEN / CONFIGURED CLOSED / required
    resetForexSessionExceptionsForTests();
    setForexHolidayRequiredForTests(false);
    setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
    assert.equal(holidayCoverage(), 'UNCONFIGURED');
    assert.equal(holidayReadiness().holidaySafe, true);
    assert.equal(isForexTradingEligible().open, true);
    setForexHolidayRequiredForTests(true);
    const requiredClosed = isForexTradingEligible();
    assert.equal(requiredClosed.open, false);
    assert.equal(requiredClosed.reason, 'HOLIDAY_UNCONFIGURED');
    setForexHolidayRequiredForTests(false);
    setForexSessionException({ date: '2026-09-02', kind: 'holiday', notes: 'test fixture only' });
    assert.equal(holidayCoverage(), 'CONFIGURED');
    assert.equal(isForexTradingEligible(new Date('2026-09-01T12:00:00.000Z')).open, true);
    const closed = isForexTradingEligible(new Date('2026-09-02T12:00:00.000Z'));
    assert.equal(closed.open, false);
    assert.equal(closed.reason, 'HOLIDAY_CLOSURE');
    const beforeNyDate = isForexTradingEligible(new Date('2026-09-02T03:00:00.000Z'));
    assert.equal(beforeNyDate.holiday, false);
    resetForexSessionExceptionsForTests();

    // 15. DST weekend + sessions (IANA, no hardcoded summer=+1)
    assert.equal(isForexWeekendClosed(new Date('2026-03-06T21:59:00.000Z')), false);
    assert.equal(isForexWeekendClosed(new Date('2026-03-06T22:00:00.000Z')), true);
    assert.equal(isForexWeekendClosed(new Date('2026-03-13T20:59:00.000Z')), false);
    assert.equal(isForexWeekendClosed(new Date('2026-03-13T21:00:00.000Z')), true);
    const londonWinter = activeForexSessions(new Date('2026-03-27T08:30:00.000Z'));
    assert.ok(londonWinter.includes('London'));
    const londonSummer = activeForexSessions(new Date('2026-03-30T07:30:00.000Z'));
    assert.ok(londonSummer.includes('London'));
    const sydneyAedt = zonedCivil(new Date('2026-03-30T20:00:00.000Z'), 'Australia/Sydney');
    assert.equal(sydneyAedt.hour, 7);
    const sydneyAest = zonedCivil(new Date('2026-04-06T21:00:00.000Z'), 'Australia/Sydney');
    assert.equal(sydneyAest.hour, 7);
    assert.equal(isForexTradingEligible(new Date('2026-09-01T12:00:00.000Z')).open, true);
    assert.equal(isForexTradingEligible(new Date('2026-09-05T12:00:00.000Z')).open, false);
    assert.equal(isForexTradingEligible(new Date('2026-09-04T21:30:00.000Z')).open, false);

    // 16. order state machine
    assert.equal(canOrderTransition('NEW', 'VALIDATING'), true);
    assert.equal(canOrderTransition('VALIDATING', 'ACCEPTED'), true);
    assert.equal(canOrderTransition('ACCEPTED', 'PENDING'), true);
    assert.equal(canOrderTransition('PENDING', 'TRIGGERING'), true);
    assert.equal(canOrderTransition('TRIGGERING', 'ROUTING'), true);
    assert.equal(canOrderTransition('ROUTING', 'SUBMITTED'), true);
    assert.equal(canOrderTransition('SUBMITTED', 'PARTIALLY_FILLED'), true);
    assert.equal(canOrderTransition('PARTIALLY_FILLED', 'FILLED'), true);
    assert.equal(canOrderTransition('FILLED', 'CANCELLED'), false);
    assert.equal(FOREX_ORDER_TERMINAL.has('FILLED'), true);

    // 17. restart does not change booked fill truth
    const pricing = seedSpread('1.16620', '1.16623');
    const durable = new ForexPositionService(new ForexPositionStore(), pricing, true);
    const acc = new ForexAccountingService(
      new ForexLedgerService(new ForexLedgerStore(), true),
      durable,
      new ForexQuoteConversionSource(pricing),
      pricing,
      true
    );
    durable.attachAccounting(acc);
    acc.ensureAccount(accountA);
    await acc.credit({
      accountId: accountA,
      amount: '10000',
      idempotencyKey: `INIT:${accountA}`,
      type: 'INITIAL_FUNDING',
    });
    const restartFill = randomUUID();
    const live = await durable.applyFill({
      fillId: restartFill,
      accountId: accountA,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    });
    assert.ok(live);
    const recovered = new ForexPositionService(new ForexPositionStore(), pricing, true);
    const { loadAllPositions, loadAllPositionFills } = await import('./positions/persist.js');
    recovered.store.hydrate(await loadAllPositions());
    for (const id of await loadAllPositionFills()) recovered.store.markFill(id);
    const replayed = await recovered.applyFill({
      fillId: restartFill,
      accountId: accountA,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    });
    assert.ok(replayed);
    assert.equal(fxDecimal(replayed.volume).eq(live.volume), true);

    const files = [
      'services/forex/orders/service.ts',
      'services/forex/execution/service.ts',
      'services/forex/sessions/eligibility.ts',
      'services/forex/execution/persist.ts',
      'services/forex/orders/persist.ts',
    ].map((f) => readFileSync(path.join(backendRoot, f), 'utf8'));
    for (const src of files) {
      assert.equal(src.includes('user_balances'), false);
      assert.equal(src.includes('balance_ledger'), false);
      assert.equal(src.includes('spot_orders'), false);
      assert.equal(src.includes('.catch(() => undefined)'), false);
    }
  } finally {
    await cleanup(accountA);
    await cleanup(accountB);
    resetForexSessionExceptionsForTests();
    setForexSessionNowForTests(null);
  }

  console.log('forex-phase96: PASS');
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
