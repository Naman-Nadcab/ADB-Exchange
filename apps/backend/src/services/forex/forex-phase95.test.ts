/**
 * Phase 9.5 — durability / concurrency / recovery.
 * Uses the same PostgreSQL as the backend. Isolated p95-* account ids only.
 * Does not trade customer money, enable real FX, or touch Crypto tables.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../../lib/database.js';
import { FOREX_EQUITY_MODEL } from './accounting/boundary.js';
import { ForexAccountingService } from './accounting/service.js';
import { persistFeeEvent, persistSwapEvent } from './advanced/persist.js';
import { lockForexPosition, withForexTransaction } from './durability/tx.js';
import { ForexLedgerService } from './ledger/service.js';
import { ForexLedgerStore } from './ledger/store.js';
import { persistLedgerTransaction } from './ledger/persist.js';
import {
  acquireForexLiquidationLock,
  hydrateForexLiquidationLocksFromDb,
  isForexAccountLiquidationLocked,
  releaseForexLiquidationLock,
  resetForexLiquidationLocksForTests,
} from './liquidation/lock.js';
import { persistOrder } from './orders/persist.js';
import { isPendingTriggered } from './orders/pending.js';
import type { ForexOrderRecord } from './orders/models.js';
import { persistAppliedFill, persistPosition } from './positions/persist.js';
import { ForexPositionService } from './positions/service.js';
import { ForexPositionStore } from './positions/store.js';
import { ForexQuoteConversionSource } from './pnl/conversion.js';
import { resetForexPricingServiceForTests } from './quotes.service.js';
import { FOREX_PROVIDER_IDS } from './instruments.catalog.js';
import { isForexTradingEligible, setForexSessionNowForTests } from './sessions/eligibility.js';
import type { ForexSwapEvent } from './swap/service.js';
import type { ForexAppliedFill, ForexPositionRecord } from './positions/models.js';
import type { ProviderRawQuote } from './types.js';

const PREFIX = 'p95-';

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function seedBook() {
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_A, providerCode: 'MOCK-A', bid: '1.16620', ask: '1.16623', providerSequence: 1n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_B, providerCode: 'MOCK-B', bid: '1.16621', ask: '1.16624', providerSequence: 1n }),
    now
  );
  pricing.ingestRaw(
    raw({ symbol: 'EURUSD', providerId: FOREX_PROVIDER_IDS.MOCK_C, providerCode: 'MOCK-C', bid: '1.16619', ask: '1.16622', providerSequence: 1n }),
    now
  );
  return pricing;
}

async function ensurePhase95Ddl(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS forex_liquidation_locks (
      account_id VARCHAR(64) PRIMARY KEY,
      liquidation_id UUID NOT NULL,
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
}

async function cleanup(accountId: string): Promise<void> {
  await db.query(`DELETE FROM forex_position_fills WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_positions WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_liquidation_locks WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_pending_orders WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM forex_orders WHERE account_id = $1`, [accountId]);
  try {
    await db.query(`DELETE FROM forex_ledger_transactions WHERE account_id = $1`, [accountId]);
  } catch {
    /* immutable after Phase 9.5 trigger */
  }
}

function dummyPosition(accountId: string, positionId: string): ForexPositionRecord {
  const now = new Date().toISOString();
  return {
    positionId,
    accountId,
    symbol: 'EURUSD',
    side: 'long',
    volume: '1',
    entryPrice: '1.16620',
    averageEntryPrice: '1.16620',
    currentPrice: '1.16621',
    lastPriceTimestamp: now,
    contractSize: '100000',
    leverage: '100',
    initialMargin: '1166.20',
    maintenanceMargin: '583.10',
    exposure: '116620',
    status: 'OPEN',
    mode: 'NETTING',
    version: 1,
    appliedFills: [],
    source: 'SIMULATED',
    valuationKind: 'CALCULATED',
    openedAt: now,
    updatedAt: now,
    closedAt: null,
  };
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
    request: { clientOrderId, symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '1', requestedPrice: '1.16' },
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    requestedVolume: '1',
    filledVolume: '0',
    remainingVolume: '1',
    requestedPrice: '1.16',
    limitPrice: null,
    timeInForce: 'GTC',
    maxSlippage: null,
    maxDeviation: null,
    status: 'PENDING',
    failureReason: null,
    executionId: null,
    fillIds: [],
    source: 'SIMULATED',
    executionMode: 'MOCK',
    venueOrderId: null,
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
  const healthy = await db.healthCheck();
  assert.equal(healthy, true, 'PostgreSQL must be reachable for Phase 9.5 tests');
  await ensurePhase95Ddl();

  const accountA = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const accountB = `${PREFIX}${randomUUID().slice(0, 8)}`;
  await cleanup(accountA);
  await cleanup(accountB);

  try {
    // 1. same fillId concurrently
    const fillId = randomUUID();
    const posId = randomUUID();
    const fill: ForexAppliedFill = {
      fillId,
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    };
    const [c1, c2] = await Promise.all([
      persistAppliedFill(accountA, posId, fill),
      persistAppliedFill(accountA, posId, fill),
    ]);
    assert.equal(c1 !== c2, true, 'exactly one concurrent fill insert wins');
    const fills = await db.query(`SELECT count(*)::int AS n FROM forex_position_fills WHERE fill_id = $1`, [fillId]);
    assert.equal((fills.rows[0] as { n: number }).n, 1);

    // 2. two fills against same position (DB lock + unique open netting)
    const pos = dummyPosition(accountA, posId);
    pos.appliedFills = [fill];
    await persistPosition(pos);
    const fill2: ForexAppliedFill = {
      fillId: randomUUID(),
      side: 'buy',
      volume: '1',
      price: '1.16630',
      timestamp: new Date().toISOString(),
    };
    await withForexTransaction(async (client) => {
      await lockForexPosition(client, accountA, 'EURUSD');
      const ok = await persistAppliedFill(accountA, posId, fill2, client);
      assert.equal(ok, true);
      pos.volume = '2';
      pos.version = 2;
      pos.appliedFills = [fill, fill2];
      await persistPosition(pos, undefined, client);
    });
    const open = await db.query(
      `SELECT count(*)::int AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
      [accountA]
    );
    assert.equal((open.rows[0] as { n: number }).n, 1);

    // 3. same swap event concurrently
    const swapKey = `SWAP:${posId}:2026-09-02`;
    const swapEvent = (id: string): ForexSwapEvent => ({
      eventId: id,
      accountId: accountA,
      positionId: posId,
      symbol: 'EURUSD',
      side: 'long',
      amount: '1.00',
      rolloverDate: '2026-09-02',
      triple: false,
      idempotencyKey: swapKey,
      timestamp: new Date().toISOString(),
      source: 'SIMULATED',
    });
    const [s1, s2] = await Promise.all([
      persistSwapEvent(swapEvent(randomUUID())),
      persistSwapEvent(swapEvent(randomUUID())),
    ]);
    assert.deepEqual([s1, s2].sort(), ['inserted', 'replay'].sort());
    const swaps = await db.query(`SELECT count(*)::int AS n FROM forex_swap_events WHERE idempotency_key = $1`, [swapKey]);
    assert.equal((swaps.rows[0] as { n: number }).n, 1);

    // 4. same liquidation account concurrently
    resetForexLiquidationLocksForTests();
    const liqA = randomUUID();
    const liqB = randomUUID();
    const [l1, l2] = await Promise.all([
      acquireForexLiquidationLock(accountA, liqA),
      acquireForexLiquidationLock(accountA, liqB),
    ]);
    assert.equal(l1 !== l2, true);
    assert.equal(isForexAccountLiquidationLocked(accountA), true);
    await hydrateForexLiquidationLocksFromDb();
    assert.equal(isForexAccountLiquidationLocked(accountA), true);
    await releaseForexLiquidationLock(accountA);
    assert.equal(isForexAccountLiquidationLocked(accountA), false);

    // 5. same clientOrderId concurrently
    const coid = `COID-${randomUUID().slice(0, 8)}`;
    const o1 = dummyOrder(accountA, coid);
    const o2 = dummyOrder(accountA, coid);
    const results = await Promise.allSettled([persistOrder(o1), persistOrder(o2)]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    assert.equal(ok, 1);
    assert.equal(rejected, 1);
    const orders = await db.query(
      `SELECT count(*)::int AS n FROM forex_orders WHERE account_id = $1 AND client_order_id = $2`,
      [accountA, coid]
    );
    assert.equal((orders.rows[0] as { n: number }).n, 1);

    // 6. recovery after committed state
    const pricing = seedBook();
    const positions = new ForexPositionService(new ForexPositionStore(), pricing, true);
    const accounting = new ForexAccountingService(
      new ForexLedgerService(new ForexLedgerStore(), true),
      positions,
      new ForexQuoteConversionSource(pricing),
      pricing,
      true
    );
    positions.attachAccounting(accounting);
    accounting.ensureAccount(accountB);
    await accounting.credit({
      accountId: accountB,
      amount: '10000',
      idempotencyKey: `INIT:${accountB}`,
      type: 'INITIAL_FUNDING',
    });
    const openFillId = randomUUID();
    const opened = await positions.applyFill({
      fillId: openFillId,
      accountId: accountB,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    });
    assert.ok(opened);
    assert.equal(opened.status, 'OPEN');
    const recovered = new ForexPositionService(new ForexPositionStore(), pricing, true);
    const { loadAllPositions, loadAllPositionFills } = await import('./positions/persist.js');
    recovered.store.hydrate(await loadAllPositions());
    for (const id of await loadAllPositionFills()) recovered.store.markFill(id);
    assert.equal(recovered.store.hasFill(openFillId), true);
    const again = await recovered.applyFill({
      fillId: openFillId,
      accountId: accountB,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '1',
      price: '1.16620',
      timestamp: new Date().toISOString(),
    });
    assert.ok(again);
    assert.equal(Number(again.volume), Number(opened.volume));

    // 7. recovery after incomplete transaction
    const ghost = randomUUID();
    await withForexTransaction(async (client) => {
      await persistAppliedFill(
        accountB,
        opened.positionId,
        { fillId: ghost, side: 'buy', volume: '1', price: '1.16620', timestamp: new Date().toISOString() },
        client
      );
      throw new Error('FORCE_ROLLBACK');
    }).catch((e: Error) => {
      assert.equal(e.message, 'FORCE_ROLLBACK');
    });
    const ghostRow = await db.query(`SELECT count(*)::int AS n FROM forex_position_fills WHERE fill_id = $1`, [ghost]);
    assert.equal((ghostRow.rows[0] as { n: number }).n, 0);

    // 8+9. duplicate accounting / fee
    const feeFill = randomUUID();
    const [f1, f2] = await Promise.all([
      persistFeeEvent({
        eventId: randomUUID(),
        accountId: accountB,
        fillId: feeFill,
        transactionId: null,
        symbol: 'EURUSD',
        amount: '1.00',
        model: 'per_lot',
        idempotencyKey: `FEE:${feeFill}`,
        metadata: {},
      }),
      persistFeeEvent({
        eventId: randomUUID(),
        accountId: accountB,
        fillId: feeFill,
        transactionId: null,
        symbol: 'EURUSD',
        amount: '1.00',
        model: 'per_lot',
        idempotencyKey: `FEE:${feeFill}`,
        metadata: {},
      }),
    ]);
    assert.deepEqual([f1, f2].sort(), ['inserted', 'replay'].sort());

    const ledger = new ForexLedgerService(new ForexLedgerStore(), true);
    const txReq = {
      idempotencyKey: `REALIZED_PNL:${openFillId}`,
      type: 'REALIZED_PNL' as const,
      accountId: accountB,
      currency: 'USD' as const,
      entries: [
        { ledgerAccount: 'REALIZED_PNL' as const, debit: '1', credit: '0' },
        { ledgerAccount: 'CUSTOMER_CASH' as const, accountId: accountB, debit: '0', credit: '1' },
      ],
    };
    const first = await ledger.post(txReq);
    const replay = await ledger.post(txReq);
    assert.equal(first.transactionId, replay.transactionId);
    await assert.rejects(
      () =>
        ledger.post({
          ...txReq,
          entries: [
            { ledgerAccount: 'REALIZED_PNL', debit: '2', credit: '0' },
            { ledgerAccount: 'CUSTOMER_CASH', accountId: accountB, debit: '0', credit: '2' },
          ],
        }),
      /idempotency/i
    );
    void persistLedgerTransaction;

    // 10. pending session recheck (no holiday fabrication)
    setForexSessionNowForTests(new Date('2026-09-05T12:00:00.000Z'));
    assert.equal(isForexTradingEligible().open, false);
    assert.equal(isForexTradingEligible().reason === 'WEEKEND_CLOSURE' || isForexTradingEligible().reason === 'FRIDAY_CLOSE', true);
    setForexSessionNowForTests(new Date('2026-09-01T12:00:00.000Z'));
    assert.equal(isForexTradingEligible().open, true);
    const pending = {
      orderType: 'limit' as const,
      side: 'buy' as const,
      requestedPrice: '1.17000',
    };
    const quote = pricing.getQuote('EURUSD');
    assert.ok(quote);
    assert.equal(isPendingTriggered(pending as ForexOrderRecord, quote), true);

    const crypto = await db.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('user_balances','balance_ledger','spot_orders','spot_trades','settlement_events')`
    );
    assert.ok(((crypto.rows[0] as { n: number }).n ?? 0) >= 1);
  } finally {
    await cleanup(accountA);
    await cleanup(accountB);
    setForexSessionNowForTests(null);
  }

  console.log('forex-phase95: PASS');
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
