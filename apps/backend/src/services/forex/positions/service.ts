import { randomUUID } from 'node:crypto';
import {
  forexExposure,
  forexMarginCallTotal,
  forexMarginCalculationTotal,
  forexMarginUtilization,
  forexMarginWarningTotal,
  forexPositionClosedTotal,
  forexPositionIncreasedTotal,
  forexPositionOpenedTotal,
  forexPositionReconciliationErrorTotal,
  forexPositionReducedTotal,
  forexPositionReversalTotal,
  forexStopOutReadyTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import type { ForexAccountingService } from '../accounting/service.js';
import { isForexAccountLiquidationLocked } from '../liquidation/lock.js';
import type { ForexLiquidationService } from '../liquidation/service.js';
import type { ForexProtectionService } from '../protection/service.js';
import { classifyMarginLevel, marginLevel, positionMarginSnapshot } from '../margin/engine.js';
import { getForexAccountPolicy, evaluateAccountRisk, type ForexRiskDecision } from '../risk/engine.js';
import type { ForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import { FOREX_ACTIVE_POSITION_MODE } from './mode.js';
import type {
  ForexAppliedFill,
  ForexPositionEvent,
  ForexPositionFillInput,
  ForexPositionRecord,
} from './models.js';
import { ForexPositionError, publicForexPosition } from './models.js';
import { applyNettingFill, replayNetting, type NettingState } from './netting.js';
import { ForexPositionStore } from './store.js';

export class ForexPositionService {
  private readonly lastMarginStatus = new Map<string, string>();
  private accounting: ForexAccountingService | null = null;
  private protection: ForexProtectionService | null = null;
  private liquidation: ForexLiquidationService | null = null;

  constructor(
    readonly store: ForexPositionStore,
    private readonly pricing?: ForexPricingService,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  attachAccounting(accounting: ForexAccountingService): void {
    this.accounting = accounting;
  }

  attachProtection(protection: ForexProtectionService): void {
    this.protection = protection;
  }

  attachLiquidation(liquidation: ForexLiquidationService): void {
    this.liquidation = liquidation;
  }

  riskAccountingInputs(accountId: string): { equity?: string; accountingAvailable: boolean } | undefined {
    return this.accounting?.riskInputs(accountId);
  }

  getOwned(accountId: string, positionId: string): ForexPositionRecord {
    const p = this.store.get(positionId);
    if (!p || p.accountId !== accountId) throw new ForexPositionError('POSITION_NOT_FOUND', 'Position not found', 404);
    return this.refreshValuation(p);
  }

  listOwned(accountId: string, openOnly = false): ForexPositionRecord[] {
    return this.store.listByAccount(accountId, openOnly).map((p) => this.refreshValuation(p));
  }

  async applyFill(input: ForexPositionFillInput): Promise<ForexPositionRecord | null> {
    return this.store.enqueue(input.accountId, input.symbol, () => this.applyFillLocked(input));
  }

  async applyFills(inputs: ForexPositionFillInput[]): Promise<ForexPositionRecord[]> {
    const out: ForexPositionRecord[] = [];
    for (const f of inputs) {
      const r = await this.applyFill(f);
      if (r) out.push(r);
    }
    return out;
  }

  previewAfterFill(input: ForexPositionFillInput): ForexPositionRecord[] {
    const open = this.store.listByAccount(input.accountId, true).map((p) => ({ ...p, appliedFills: [...p.appliedFills] }));
    const existing = open.find((p) => p.symbol === input.symbol) ?? null;
    const fill: ForexAppliedFill = {
      fillId: input.fillId,
      side: input.side,
      volume: input.volume,
      price: input.price,
      timestamp: input.timestamp,
    };
    const result = applyNettingFill(existing ? toNet(existing) : null, fill);
    const others = open.filter((p) => p.symbol !== input.symbol);
    if (result.after.status === 'CLOSED') return others;
    const next = this.materialize(input.accountId, input.symbol, result.after, existing, [fill], input.price);
    return [...others, next];
  }

  reconcile(position: ForexPositionRecord): { ok: true } | { ok: false; reason: 'POSITION_RECONCILIATION_ERROR'; detail: string } {
    const replayed = replayNetting(position.appliedFills);
    if (position.status === 'CLOSED') {
      if (replayed && fxDecimal(replayed.volume).gt(0)) {
        return failRec(position, 'closed position still has net volume');
      }
      return { ok: true };
    }
    if (!replayed || replayed.status === 'CLOSED') {
      return failRec(position, 'open position does not replay from fills');
    }
    if (replayed.side !== position.side || replayed.volume !== position.volume) {
      return failRec(position, `replay ${replayed.side} ${replayed.volume} != ${position.side} ${position.volume}`);
    }
    if (replayed.entryPrice !== position.entryPrice) {
      return failRec(position, `entry ${replayed.entryPrice} != ${position.entryPrice}`);
    }
    return { ok: true };
  }

  accountSnapshot(accountId: string): {
    accountId: string;
    balanceReference: string;
    equityReference: string;
    usedMargin: string;
    maintenanceMargin: string;
    freeMargin: string;
    marginLevel: string | null;
    effectiveLeverage: string;
    totalExposure: string;
    grossExposure: string;
    netExposure: string;
    symbolExposures: Record<string, string>;
    status: ReturnType<typeof classifyMarginLevel>;
    ledgerBalance?: string;
    unrealizedPnl?: string;
    calculationStatus?: string;
    source: 'SIMULATED';
    valuationKind: 'CALCULATED';
    timestamp: string;
  } {
    const positions = this.listOwned(accountId, true);
    const policy = getForexAccountPolicy(accountId);
    const inputs = this.accounting?.riskInputs(accountId);
    const decision = evaluateAccountRisk({
      accountId,
      positions,
      equity: inputs?.equity,
      accountingAvailable: inputs?.accountingAvailable,
    });
    let maint = fxDecimal(0);
    for (const p of positions) maint = maint.plus(p.maintenanceMargin);
    const status = classifyMarginLevel(decision.marginLevel);
    this.observeMargin(accountId, status, decision);
    const ledgerBalance = this.accounting?.ledgerBalance(accountId) ?? policy.balanceReference;
    const equity = inputs?.equity ?? policy.balanceReference;
    return {
      accountId,
      balanceReference: ledgerBalance,
      equityReference: equity,
      usedMargin: decision.usedMargin,
      maintenanceMargin: maint.toFixed(),
      freeMargin: decision.freeMargin,
      marginLevel: decision.marginLevel,
      effectiveLeverage: policy.maxLeverage,
      totalExposure: decision.totalExposure,
      grossExposure: decision.grossExposure,
      netExposure: decision.netExposure,
      symbolExposures: decision.symbolExposures,
      status,
      ledgerBalance,
      unrealizedPnl: this.accounting && inputs?.accountingAvailable ? fxDecimal(equity).minus(ledgerBalance).toFixed() : undefined,
      calculationStatus: inputs ? (inputs.accountingAvailable ? 'CALCULATED' : 'ACCOUNTING_UNAVAILABLE') : undefined,
      source: 'SIMULATED',
      valuationKind: 'CALCULATED',
      timestamp: new Date().toISOString(),
    };
  }

  riskSnapshot(accountId: string): ForexRiskDecision & { source: 'SIMULATED'; valuationKind: 'CALCULATED'; timestamp: string; policy: ReturnType<typeof getForexAccountPolicy> } {
    const positions = this.listOwned(accountId, true);
    const inputs = this.accounting?.riskInputs(accountId);
    const decision = evaluateAccountRisk({
      accountId,
      positions,
      equity: inputs?.equity,
      accountingAvailable: inputs?.accountingAvailable,
    });
    return {
      ...decision,
      source: 'SIMULATED',
      valuationKind: 'CALCULATED',
      timestamp: new Date().toISOString(),
      policy: getForexAccountPolicy(accountId),
    };
  }

  recoverOpen(): ForexPositionRecord[] {
    const open = this.store.listOpen();
    for (const p of open) {
      this.refreshValuation(p);
      this.emit(p, 'POSITION_RECOVERED', null);
    }
    return open;
  }

  private async applyFillLocked(input: ForexPositionFillInput): Promise<ForexPositionRecord | null> {
    if (this.store.hasFill(input.fillId)) return this.store.getOpen(input.accountId, input.symbol) ?? null;
    const fill: ForexAppliedFill = {
      fillId: input.fillId,
      side: input.side,
      volume: input.volume,
      price: input.price,
      timestamp: input.timestamp,
      executionId: input.executionId,
      orderId: input.orderId,
    };
    const existing = this.store.getOpen(input.accountId, input.symbol) ?? null;
    const result = applyNettingFill(existing ? toNet(existing) : null, fill);
    if (this.accounting && fxDecimal(result.closedVolume).gt(0) && existing) {
      await this.accounting.postRealizedFromFill({
        accountId: input.accountId,
        fillId: fill.fillId,
        positionId: existing.positionId,
        symbol: input.symbol,
        side: existing.side,
        entryPrice: existing.entryPrice,
        closePrice: fill.price,
        closedVolume: result.closedVolume,
      });
    }
    const now = new Date().toISOString();
    const currentPx = this.currentPrice(input.symbol, input.price);
    const target = this.materialize(input.accountId, input.symbol, result.after, existing, existing ? [...existing.appliedFills, fill] : [fill], currentPx);
    if (existing) {
      target.positionId = existing.positionId;
      target.openedAt = existing.openedAt;
      target.version = existing.version + 1;
    }
    if (result.eventType === 'POSITION_REVERSED' && existing) {
      const closeFill: ForexAppliedFill = { ...fill, volume: result.closedVolume };
      const openFill: ForexAppliedFill = { ...fill, volume: result.openedVolume };
      existing.status = 'CLOSED';
      existing.volume = '0';
      existing.closedAt = now;
      existing.updatedAt = now;
      existing.version += 1;
      existing.appliedFills = [...existing.appliedFills, closeFill];
      this.store.put(existing);
      this.emit(existing, 'POSITION_CLOSED', fill.fillId, { reversed: true });
      const opened = this.materialize(input.accountId, input.symbol, result.after, null, [openFill], currentPx);
      this.store.markFill(fill.fillId);
      this.store.put(opened);
      this.persist(opened);
      this.emit(opened, 'POSITION_REVERSED', fill.fillId);
      this.emit(opened, 'POSITION_OPENED', fill.fillId, { reversedFrom: existing.positionId });
      forexPositionReversalTotal.inc({ symbol: input.symbol });
      forexPositionOpenedTotal.inc({ symbol: input.symbol, side: opened.side });
      this.publish(opened, 'fx.position');
      this.notifyLifecycle(input.accountId, existing.positionId);
      return opened;
    }

    this.store.markFill(fill.fillId);
    this.store.put(target);
    this.persist(target);
    this.emit(target, result.eventType, fill.fillId);
    if (result.eventType === 'POSITION_OPENED') forexPositionOpenedTotal.inc({ symbol: input.symbol, side: target.side });
    if (result.eventType === 'POSITION_INCREASED') forexPositionIncreasedTotal.inc({ symbol: input.symbol });
    if (result.eventType === 'POSITION_REDUCED') forexPositionReducedTotal.inc({ symbol: input.symbol });
    if (result.eventType === 'POSITION_CLOSED') forexPositionClosedTotal.inc({ symbol: input.symbol });
    this.publish(target, 'fx.position');
    const snap = this.accountSnapshot(input.accountId);
    this.publishAccount(input.accountId, snap);
    this.notifyLifecycle(input.accountId, result.eventType === 'POSITION_CLOSED' && existing ? existing.positionId : undefined);
    return target;
  }

  private notifyLifecycle(accountId: string, closedPositionId?: string): void {
    if (closedPositionId) this.protection?.onPositionClosed(accountId, closedPositionId);
    if (this.liquidation && !isForexAccountLiquidationLocked(accountId)) {
      void this.liquidation.evaluateAccount(accountId).catch(() => undefined);
    }
  }

  private materialize(
    accountId: string,
    symbol: string,
    state: NettingState,
    existing: ForexPositionRecord | null,
    fills: ForexAppliedFill[],
    currentPrice: string
  ): ForexPositionRecord {
    const now = new Date().toISOString();
    const vol = state.status === 'CLOSED' ? '0' : state.volume;
    const px = state.entryPrice;
    const m = positionMarginSnapshot({
      symbol,
      volume: vol,
      entryPrice: px,
      currentPrice,
      accountMaxLeverage: getForexAccountPolicy(accountId).maxLeverage,
    });
    forexMarginCalculationTotal.inc({ symbol });
    return {
      positionId: existing?.positionId ?? randomUUID(),
      accountId,
      symbol,
      side: state.side,
      volume: vol,
      entryPrice: px,
      averageEntryPrice: px,
      currentPrice,
      lastPriceTimestamp: now,
      contractSize: m.contractSize,
      leverage: m.leverage,
      initialMargin: state.status === 'CLOSED' ? '0' : m.initialMargin,
      maintenanceMargin: state.status === 'CLOSED' ? '0' : m.maintenanceMargin,
      exposure: state.status === 'CLOSED' ? '0' : m.exposure,
      status: state.status,
      mode: FOREX_ACTIVE_POSITION_MODE,
      version: existing ? existing.version + 1 : 1,
      appliedFills: fills,
      source: 'SIMULATED',
      valuationKind: 'CALCULATED',
      openedAt: existing?.openedAt ?? now,
      updatedAt: now,
      closedAt: state.status === 'CLOSED' ? now : null,
    };
  }

  private refreshValuation(p: ForexPositionRecord): ForexPositionRecord {
    if (p.status !== 'OPEN') return p;
    const current = this.currentPrice(p.symbol, p.entryPrice);
    const m = positionMarginSnapshot({
      symbol: p.symbol,
      volume: p.volume,
      entryPrice: p.entryPrice,
      currentPrice: current,
      accountMaxLeverage: getForexAccountPolicy(p.accountId).maxLeverage,
    });
    p.currentPrice = current;
    p.lastPriceTimestamp = new Date().toISOString();
    p.contractSize = m.contractSize;
    p.leverage = m.leverage;
    p.initialMargin = m.initialMargin;
    p.maintenanceMargin = m.maintenanceMargin;
    p.exposure = m.exposure;
    return p;
  }

  private currentPrice(symbol: string, fallback: string): string {
    const q = this.pricing?.getQuote(symbol);
    return q?.mid ?? fallback;
  }

  private emit(
    position: ForexPositionRecord,
    eventType: ForexPositionEvent['eventType'],
    sourceFillId: string | null,
    metadata?: Record<string, unknown>
  ): void {
    const event: ForexPositionEvent = {
      eventId: randomUUID(),
      positionId: position.positionId,
      accountId: position.accountId,
      symbol: position.symbol,
      side: position.side,
      volume: position.volume,
      entryPrice: position.entryPrice,
      eventType,
      sourceFillId,
      timestamp: new Date().toISOString(),
      reason: null,
      metadata,
    };
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistPositionEvent(event))
      .catch(() => undefined);
  }

  private persist(record: ForexPositionRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistPosition(record))
      .catch(() => undefined);
  }

  private publish(position: ForexPositionRecord, type: string): void {
    forexWsHub.publishPrivate(position.accountId, type, {
      source: 'SIMULATED',
      valuationKind: 'CALCULATED',
      event: type,
      position: publicForexPosition(position),
    });
  }

  private publishAccount(accountId: string, snap: ReturnType<ForexPositionService['accountSnapshot']>): void {
    forexWsHub.publishPrivate(accountId, 'fx.margin', { source: 'SIMULATED', valuationKind: 'CALCULATED', margin: snap });
    forexWsHub.publishPrivate(accountId, 'fx.risk', { source: 'SIMULATED', valuationKind: 'CALCULATED', risk: this.riskSnapshot(accountId) });
  }

  private observeMargin(accountId: string, status: ReturnType<typeof classifyMarginLevel>, decision: ForexRiskDecision): void {
    forexMarginUtilization.set({ account: accountId }, Number(decision.marginUtilization));
    forexExposure.set({ account: accountId }, Number(decision.totalExposure));
    const prev = this.lastMarginStatus.get(accountId);
    if (prev !== status) {
      this.lastMarginStatus.set(accountId, status);
      if (status === 'WARNING') forexMarginWarningTotal.inc({ account: accountId });
      if (status === 'MARGIN_CALL') forexMarginCallTotal.inc({ account: accountId });
      if (status === 'STOP_OUT_READY') forexStopOutReadyTotal.inc({ account: accountId });
    }
    void marginLevel;
  }
}

function toNet(p: ForexPositionRecord): NettingState {
  return { side: p.side, volume: p.volume, entryPrice: p.entryPrice, status: p.status };
}

function failRec(position: ForexPositionRecord, detail: string) {
  forexPositionReconciliationErrorTotal.inc({ symbol: position.symbol });
  return { ok: false as const, reason: 'POSITION_RECONCILIATION_ERROR' as const, detail };
}

let posSingleton: ForexPositionService | null = null;

export function getForexPositionService(pricing?: ForexPricingService): ForexPositionService {
  if (!posSingleton) posSingleton = new ForexPositionService(new ForexPositionStore(), pricing, true);
  return posSingleton;
}

export function resetForexPositionServiceForTests(pricing?: ForexPricingService): ForexPositionService {
  posSingleton = new ForexPositionService(new ForexPositionStore(), pricing, false);
  return posSingleton;
}
