import { randomUUID } from 'node:crypto';
import {
  forexLiquidationCompletedTotal,
  forexLiquidationDuplicateTotal,
  forexLiquidationEligibleTotal,
  forexLiquidationFailedTotal,
  forexLiquidationLatency,
  forexLiquidationStartedTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import type { ForexAccountingService } from '../accounting/service.js';
import { getForexAccountPolicy } from '../risk/engine.js';
import type { ForexOrderService } from '../orders/service.js';
import type { ForexPositionService } from '../positions/service.js';
import { forexWsHub } from '../ws/hub.js';
import { calculateLiquidationEligibility } from './eligibility.js';
import {
  acquireForexLiquidationLock,
  isForexAccountLiquidationLocked,
  releaseForexLiquidationLock,
  setForexAccountLiquidationLock,
} from './lock.js';
import { ForexLiquidationError, publicForexLiquidation, type ForexLiquidationEvent, type ForexLiquidationRecord } from './models.js';
import { rankLiquidationCandidates } from './priority.js';
import { assertLiquidationTransition } from './states.js';
import { ForexLiquidationStore } from './store.js';

const MAX_ATTEMPTS = 2;

export class ForexLiquidationService {
  constructor(
    readonly store: ForexLiquidationStore,
    private readonly positions: ForexPositionService,
    private readonly orders: ForexOrderService,
    private readonly accounting: ForexAccountingService | null,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  status(accountId: string): {
    lock: boolean;
    eligibility: ReturnType<typeof calculateLiquidationEligibility>;
    active: ReturnType<typeof publicForexLiquidation> | null;
    history: ReturnType<typeof publicForexLiquidation>[];
    source: 'SIMULATED';
    executionMode: 'MOCK';
  } {
    return {
      lock: isForexAccountLiquidationLocked(accountId),
      eligibility: this.eligibility(accountId),
      active: this.store.activeForAccount(accountId) ? publicForexLiquidation(this.store.activeForAccount(accountId)!) : null,
      history: this.store.listByAccount(accountId).map(publicForexLiquidation),
      source: 'SIMULATED',
      executionMode: 'MOCK',
    };
  }

  getOwned(accountId: string, liquidationId: string): ForexLiquidationRecord {
    const l = this.store.get(liquidationId);
    if (!l || l.accountId !== accountId) throw new ForexLiquidationError('LIQUIDATION_NOT_FOUND', 'Liquidation not found', 404);
    return l;
  }

  eligibility(accountId: string) {
    const inputs = this.accounting?.riskInputs(accountId);
    return calculateLiquidationEligibility({
      positions: this.positions.listOwned(accountId, true),
      equity: inputs?.equity,
      accountingAvailable: inputs?.accountingAvailable,
    });
  }

  async evaluateAccount(accountId: string): Promise<ForexLiquidationRecord | null> {
    return this.store.enqueue(accountId, () => this.evaluateLocked(accountId));
  }

  recover(): ForexLiquidationRecord[] {
    for (const snap of this.store.snapshot()) {
      const l = this.store.get(snap.liquidationId);
      if (!l) continue;
      if (l.status === 'PENDING' || l.status === 'EXECUTING' || l.status === 'PARTIALLY_LIQUIDATED') {
        this.fail(l, 'RECOVERY_FAIL_CLOSED');
      }
    }
    return this.store.snapshot();
  }

  async hydrateFromDb(): Promise<void> {
    if (!this.persistEnabled) return;
    const { loadAllLiquidations } = await import('./persist.js');
    this.store.hydrate(await loadAllLiquidations());
    this.recover();
  }

  reconcile(accountId: string): { ok: boolean; reason: string | null } {
    const active = this.store.activeForAccount(accountId);
    if (active && !isForexAccountLiquidationLocked(accountId)) {
      return { ok: false, reason: 'LOCK_MISMATCH' };
    }
    return { ok: true, reason: null };
  }

  private eligibilityOrHalt(accountId: string) {
    if (getForexAccountPolicy(accountId).killSwitch) {
      return { halt: true as const, elig: this.eligibility(accountId) };
    }
    return { halt: false as const, elig: this.eligibility(accountId) };
  }

  private async evaluateLocked(accountId: string): Promise<ForexLiquidationRecord | null> {
    const existing = this.store.activeForAccount(accountId);
    if (existing) {
      forexLiquidationDuplicateTotal.inc({});
      return existing;
    }
    const { halt, elig } = this.eligibilityOrHalt(accountId);
    if (elig.status === 'ACCOUNTING_UNAVAILABLE') {
      return null;
    }
    if (!elig.eligible) return null;
    forexLiquidationEligibleTotal.inc({});
    if (halt) {
      const halted = this.createRecord(accountId, elig, 'HALTED');
      this.emit(halted, 'LIQUIDATION_HALTED', { reason: 'FOREX_KILL_SWITCH' });
      this.publish(halted, 'fx.liquidation');
      return halted;
    }
    const started = Date.now();
    const rec = this.createRecord(accountId, elig, 'ELIGIBLE');
    if (this.persistEnabled) {
      const acquired = await acquireForexLiquidationLock(accountId, rec.liquidationId);
      if (!acquired) {
        forexLiquidationDuplicateTotal.inc({});
        return this.store.activeForAccount(accountId) ?? null;
      }
    }
    this.transition(rec, 'PENDING');
    setForexAccountLiquidationLock(accountId, true);
    forexLiquidationStartedTotal.inc({});
    this.emit(rec, 'LIQUIDATION_STARTED');
    this.publish(rec, 'fx.liquidation');
    try {
      await this.execute(rec);
    } finally {
      if (rec.status !== 'EXECUTING' && rec.status !== 'PENDING' && rec.status !== 'PARTIALLY_LIQUIDATED') {
        setForexAccountLiquidationLock(accountId, false);
        if (this.persistEnabled) await releaseForexLiquidationLock(accountId);
      }
    }
    forexLiquidationLatency.observe({}, (Date.now() - started) / 1000);
    return rec;
  }

  private async execute(rec: ForexLiquidationRecord): Promise<void> {
    this.transition(rec, rec.status === 'PARTIALLY_LIQUIDATED' ? 'EXECUTING' : 'EXECUTING');
    const ranked = rankLiquidationCandidates(this.positions.listOwned(rec.accountId, true));
    const target = ranked[0];
    if (!target) {
      this.transition(rec, 'LIQUIDATED');
      rec.reason = 'NO_OPEN_POSITIONS';
      forexLiquidationCompletedTotal.inc({});
      this.emit(rec, 'LIQUIDATION_COMPLETED');
      this.publish(rec, 'fx.liquidation.updated');
      return;
    }
    rec.selectedPositionId = target.positionId;
    rec.attempt += 1;
    if (rec.attempt > MAX_ATTEMPTS) {
      this.fail(rec, 'MAX_ATTEMPTS');
      return;
    }
    const clientOrderId = `LIQ-${rec.liquidationId}-${target.positionId}-${rec.attempt}`;
    const closeSide = target.side === 'long' ? 'sell' : 'buy';
    try {
      const order = await this.orders.place(rec.accountId, {
        clientOrderId,
        symbol: target.symbol,
        side: closeSide,
        orderType: 'market',
        volume: target.volume,
        intent: 'LIQUIDATION_CLOSE',
        reducePositionId: target.positionId,
      });
      rec.orderIds.push(order.orderId);
      if (order.status === 'FILLED') {
        const still = this.eligibility(rec.accountId);
        if (!still.eligible || this.positions.listOwned(rec.accountId, true).length === 0) {
          this.transition(rec, 'LIQUIDATED');
          rec.reason = still.reason;
          forexLiquidationCompletedTotal.inc({});
          this.emit(rec, 'LIQUIDATION_COMPLETED', { metadata: { orderId: order.orderId } });
        } else if (rec.attempt < MAX_ATTEMPTS) {
          this.transition(rec, 'PARTIALLY_LIQUIDATED');
          this.emit(rec, 'LIQUIDATION_PARTIAL', { metadata: { orderId: order.orderId } });
          await this.execute(rec);
        } else {
          this.transition(rec, 'PARTIALLY_LIQUIDATED');
          rec.reason = 'MAX_ATTEMPTS';
          this.emit(rec, 'LIQUIDATION_PARTIAL', { reason: 'MAX_ATTEMPTS' });
        }
      } else {
        this.fail(rec, order.failureReason ?? order.status);
      }
    } catch (e) {
      this.fail(rec, e instanceof Error ? e.message : 'ORDER_FAILED');
    }
    this.publish(rec, 'fx.liquidation.updated');
  }

  private createRecord(
    accountId: string,
    elig: ReturnType<typeof calculateLiquidationEligibility>,
    status: ForexLiquidationRecord['status']
  ): ForexLiquidationRecord {
    const now = new Date().toISOString();
    const rec: ForexLiquidationRecord = {
      liquidationId: randomUUID(),
      accountId,
      status: 'NOT_ELIGIBLE',
      reason: elig.reason,
      equity: elig.equity,
      usedMargin: elig.usedMargin,
      maintenanceMargin: elig.maintenanceMargin,
      marginLevel: elig.marginLevel,
      selectedPositionId: null,
      attempt: 0,
      orderIds: [],
      source: 'SIMULATED',
      executionMode: 'MOCK',
      createdAt: now,
      updatedAt: now,
    };
    this.store.put(rec);
    if (status !== 'NOT_ELIGIBLE') this.transition(rec, status);
    this.persist(rec);
    return rec;
  }

  private fail(rec: ForexLiquidationRecord, reason: string): void {
    rec.reason = reason;
    if (rec.status !== 'FAILED' && rec.status !== 'HALTED' && rec.status !== 'LIQUIDATED') {
      try {
        this.transition(rec, rec.status === 'NOT_ELIGIBLE' || rec.status === 'ELIGIBLE' ? 'HALTED' : 'FAILED');
      } catch {
        rec.status = 'FAILED';
      }
    }
    setForexAccountLiquidationLock(rec.accountId, false);
    if (this.persistEnabled) {
      void releaseForexLiquidationLock(rec.accountId);
    }
    forexLiquidationFailedTotal.inc({ reason });
    this.emit(rec, 'LIQUIDATION_FAILED', { reason });
    this.persist(rec);
  }

  private transition(rec: ForexLiquidationRecord, to: ForexLiquidationRecord['status']): void {
    assertLiquidationTransition(rec.status, to);
    rec.status = to;
    rec.updatedAt = new Date().toISOString();
    this.persist(rec);
  }

  private emit(rec: ForexLiquidationRecord, eventType: string, extra?: { reason?: string; metadata?: Record<string, unknown> }): void {
    const event: ForexLiquidationEvent = {
      eventId: randomUUID(),
      liquidationId: rec.liquidationId,
      accountId: rec.accountId,
      eventType,
      reason: extra?.reason,
      timestamp: new Date().toISOString(),
      metadata: extra?.metadata,
    };
    this.store.events.push(event);
    if (eventType === 'LIQUIDATION_STARTED') {
      void import('../customer/alert-engine.js').then((m) =>
        m.evaluateForexAccountEventAlerts({
          accountId: rec.accountId,
          alertType: 'LIQUIDATION',
          message: `Liquidation started for ${rec.accountId}`,
          metadata: { liquidationId: rec.liquidationId },
        })
      );
    }
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistLiquidationEvent(event))
      .catch(() => undefined);
  }

  private persist(rec: ForexLiquidationRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js').then((m) => m.persistLiquidation(rec));
  }

  private publish(rec: ForexLiquidationRecord, type: string): void {
    forexWsHub.publishPrivate(rec.accountId, type, {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      liquidation: publicForexLiquidation(rec),
    });
  }
}

let singleton: ForexLiquidationService | null = null;

export function getForexLiquidationService(
  positions: ForexPositionService,
  orders: ForexOrderService,
  accounting: ForexAccountingService | null
): ForexLiquidationService {
  if (!singleton) {
    singleton = new ForexLiquidationService(new ForexLiquidationStore(), positions, orders, accounting, true);
    positions.attachLiquidation(singleton);
  }
  return singleton;
}

export function resetForexLiquidationServiceForTests(
  positions: ForexPositionService,
  orders: ForexOrderService,
  accounting: ForexAccountingService | null
): ForexLiquidationService {
  singleton = new ForexLiquidationService(new ForexLiquidationStore(), positions, orders, accounting, false);
  return singleton;
}
