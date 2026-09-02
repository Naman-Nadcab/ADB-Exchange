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
import { fxDecimal } from '../decimal-fx.js';
import type { ForexAccountingService } from '../accounting/service.js';
import { isForexAccountLiquidationLocked } from '../liquidation/lock.js';
import type { ForexLiquidationService } from '../liquidation/service.js';
import type { ForexProtectionService } from '../protection/service.js';
import { executableClosePrice } from '../pnl/engine.js';
import { classifyMarginLevel, marginLevel, positionMarginSnapshot } from '../margin/engine.js';
import { getForexAccountPolicy, evaluateAccountRisk, type ForexRiskDecision } from '../risk/engine.js';
import type { ForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import { lockForexAccount, lockForexPosition, withForexTransaction, type ForexQueryable } from '../durability/tx.js';
import { FOREX_ACTIVE_POSITION_MODE } from './mode.js';
import type {
  ForexAppliedFill,
  ForexPositionEvent,
  ForexPositionFillInput,
  ForexPositionRecord,
  ForexPositionSide,
} from './models.js';
import { ForexPositionError, publicForexPosition } from './models.js';
import { applyNettingFill, replayNetting, type NettingState } from './netting.js';
import { ForexPositionStore } from './store.js';

type FillPlan = {
  fill: ForexAppliedFill;
  existing: ForexPositionRecord | null;
  target: ForexPositionRecord;
  result: ReturnType<typeof applyNettingFill>;
  reversed: boolean;
  ledgerTxs: import('../ledger/models.js').ForexLedgerTransaction[];
};

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

  riskAccountingInputs(accountId: string): { equity?: string; accountingAvailable: boolean; ledgerBalance?: string } | undefined {
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

  async applyFill(input: ForexPositionFillInput, client?: ForexQueryable): Promise<ForexPositionRecord | null> {
    if (!this.persistEnabled) {
      return this.store.enqueue(input.accountId, input.symbol, () => this.applyFillMemory(input));
    }
    if (client) {
      const plan = await this.persistFillPlan(input, client);
      if (!plan) return this.store.getOpen(input.accountId, input.symbol) ?? null;
      this.commitEconomicMemory(plan);
      return plan.target;
    }
    return this.store.enqueue(input.accountId, input.symbol, async () => {
      const plan = await withForexTransaction(async (c) => {
        await lockForexAccount(c, input.accountId);
        await lockForexPosition(c, input.accountId, input.symbol);
        return this.persistFillPlan(input, c);
      });
      if (!plan) return this.store.getOpen(input.accountId, input.symbol) ?? null;
      this.commitEconomicMemory(plan);
      return plan.target;
    });
  }

  async applyFills(inputs: ForexPositionFillInput[]): Promise<ForexPositionRecord[]> {
    if (!this.persistEnabled || inputs.length === 0) {
      const out: ForexPositionRecord[] = [];
      for (const f of inputs) {
        const r = await this.applyFill(f);
        if (r) out.push(r);
      }
      return out;
    }
    const accountId = inputs[0]!.accountId;
    const plans = await this.store.enqueueAccount(accountId, () =>
      withForexTransaction(async (c) => {
        await lockForexAccount(c, accountId);
        const out: FillPlan[] = [];
        for (const input of inputs) {
          await lockForexPosition(c, input.accountId, input.symbol);
          const plan = await this.persistFillPlan(input, c);
          if (plan) out.push(plan);
        }
        return out;
      })
    );
    const records: ForexPositionRecord[] = [];
    for (const plan of plans) {
      this.commitEconomicMemory(plan);
      records.push(plan.target);
    }
    return records;
  }

  async applyFillsInTransaction(
    inputs: ForexPositionFillInput[],
    afterEach?: (
      input: ForexPositionFillInput,
      client: ForexQueryable
    ) => Promise<import('../ledger/models.js').ForexLedgerTransaction | null | void>,
    lifecycle?: (client: ForexQueryable) => Promise<void>
  ): Promise<ForexPositionRecord[]> {
    if (!this.persistEnabled) return this.applyFills(inputs);
    if (inputs.length === 0) return [];
    const accountId = inputs[0]!.accountId;
    const packed = await this.store.enqueueAccount(accountId, () =>
      withForexTransaction(async (c) => {
        await lockForexAccount(c, accountId);
        const out: FillPlan[] = [];
        const extras: import('../ledger/models.js').ForexLedgerTransaction[] = [];
        for (const input of inputs) {
          await lockForexPosition(c, input.accountId, input.symbol);
          const plan = await this.persistFillPlan(input, c);
          if (plan) {
            out.push(plan);
            if (afterEach) {
              const extra = await afterEach(input, c);
              if (extra) extras.push(extra);
            }
          }
        }
        if (lifecycle) await lifecycle(c);
        return { out, extras };
      })
    );
    for (const tx of packed.extras) this.accounting?.ledger.store.put(tx);
    const records: ForexPositionRecord[] = [];
    for (const plan of packed.out) {
      this.commitEconomicMemory(plan);
      records.push(plan.target);
    }
    return records;
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
    if (replayed.side !== position.side || !fxDecimal(replayed.volume).eq(position.volume)) {
      return failRec(position, `replay ${replayed.side} ${replayed.volume} != ${position.side} ${position.volume}`);
    }
    if (!fxDecimal(replayed.entryPrice).eq(position.entryPrice)) {
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

  private async persistFillPlan(input: ForexPositionFillInput, client: ForexQueryable): Promise<FillPlan | null> {
    const persist = await import('./persist.js');
    const seen = await client.query(`SELECT fill_id FROM forex_position_fills WHERE fill_id = $1`, [input.fillId]);
    if ((seen.rowCount ?? 0) > 0 || this.store.hasFill(input.fillId)) {
      await this.hydrateOpenSymbol(input.accountId, input.symbol, persist, client);
      return null;
    }
    await this.hydrateOpenSymbol(input.accountId, input.symbol, persist, client);
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
    const now = new Date().toISOString();
    const valuationSide: ForexPositionSide =
      result.after.status === 'CLOSED' ? (existing?.side ?? result.after.side) : result.after.side;
    const currentPx = this.currentPrice(input.symbol, input.price, valuationSide);
    const ledgerTxs: import('../ledger/models.js').ForexLedgerTransaction[] = [];

    if (result.eventType === 'POSITION_REVERSED' && existing) {
      const closeFill: ForexAppliedFill = { ...fill, volume: result.closedVolume };
      const openFill: ForexAppliedFill = { ...fill, volume: result.openedVolume };
      const closed: ForexPositionRecord = {
        ...existing,
        status: 'CLOSED',
        volume: '0',
        closedAt: now,
        updatedAt: now,
        version: existing.version + 1,
        appliedFills: [...existing.appliedFills, closeFill],
      };
      const opened = this.materialize(input.accountId, input.symbol, result.after, null, [openFill], currentPx);
      const claimed = await persist.persistAppliedFill(input.accountId, opened.positionId, fill, client);
      if (!claimed) {
        await this.hydrateOpenSymbol(input.accountId, input.symbol, persist, client);
        return null;
      }
      if (this.accounting && fxDecimal(result.closedVolume).gt(0)) {
        const posted = await this.accounting.postRealizedFromFill(
          {
            accountId: input.accountId,
            fillId: fill.fillId,
            positionId: existing.positionId,
            symbol: input.symbol,
            side: existing.side,
            entryPrice: existing.entryPrice,
            closePrice: fill.price,
            closedVolume: result.closedVolume,
          },
          client
        );
        ledgerTxs.push(posted.transaction);
      }
      await persist.persistPosition(closed, undefined, client);
      await persist.persistPosition(opened, undefined, client);
      return { fill, existing: closed, target: opened, result, reversed: true, ledgerTxs };
    }

    const target = this.materialize(
      input.accountId,
      input.symbol,
      result.after,
      existing,
      existing ? [...existing.appliedFills, fill] : [fill],
      currentPx
    );
    if (existing) {
      target.positionId = existing.positionId;
      target.openedAt = existing.openedAt;
      target.version = existing.version + 1;
    }
    const claimed = await persist.persistAppliedFill(input.accountId, target.positionId, fill, client);
    if (!claimed) {
      await this.hydrateOpenSymbol(input.accountId, input.symbol, persist, client);
      return null;
    }
    if (this.accounting && fxDecimal(result.closedVolume).gt(0) && existing) {
      const posted = await this.accounting.postRealizedFromFill(
        {
          accountId: input.accountId,
          fillId: fill.fillId,
          positionId: existing.positionId,
          symbol: input.symbol,
          side: existing.side,
          entryPrice: existing.entryPrice,
          closePrice: fill.price,
          closedVolume: result.closedVolume,
        },
        client
      );
      ledgerTxs.push(posted.transaction);
    }
    await persist.persistPosition(target, undefined, client);
    return { fill, existing, target, result, reversed: false, ledgerTxs };
  }

  private async hydrateOpenSymbol(
    accountId: string,
    symbol: string,
    persist: typeof import('./persist.js'),
    client: ForexQueryable
  ): Promise<void> {
    const open = await persist.loadOpenPositions(client);
    const match = open.find((p) => p.accountId === accountId && p.symbol === symbol);
    if (match) this.store.put(match);
  }

  private async applyFillMemory(input: ForexPositionFillInput): Promise<ForexPositionRecord | null> {
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
    const valuationSide: ForexPositionSide =
      result.after.status === 'CLOSED' ? (existing?.side ?? result.after.side) : result.after.side;
    const currentPx = this.currentPrice(input.symbol, input.price, valuationSide);
    if (result.eventType === 'POSITION_REVERSED' && existing) {
      const closeFill: ForexAppliedFill = { ...fill, volume: result.closedVolume };
      const openFill: ForexAppliedFill = { ...fill, volume: result.openedVolume };
      existing.status = 'CLOSED';
      existing.volume = '0';
      existing.closedAt = now;
      existing.updatedAt = now;
      existing.version += 1;
      existing.appliedFills = [...existing.appliedFills, closeFill];
      const opened = this.materialize(input.accountId, input.symbol, result.after, null, [openFill], currentPx);
      this.commitFillMemory({ fill, existing, target: opened, result, reversed: true });
      return opened;
    }
    const target = this.materialize(
      input.accountId,
      input.symbol,
      result.after,
      existing,
      existing ? [...existing.appliedFills, fill] : [fill],
      currentPx
    );
    if (existing) {
      target.positionId = existing.positionId;
      target.openedAt = existing.openedAt;
      target.version = existing.version + 1;
    }
    this.commitFillMemory({ fill, existing, target, result, reversed: false });
    return target;
  }

  private commitEconomicMemory(plan: FillPlan): void {
    for (const tx of plan.ledgerTxs) this.accounting?.ledger.store.put(tx);
    this.commitFillMemory(plan);
  }

  private commitFillMemory(args: {
    fill: ForexAppliedFill;
    existing: ForexPositionRecord | null;
    target: ForexPositionRecord;
    result: ReturnType<typeof applyNettingFill>;
    reversed: boolean;
  }): void {
    const { fill, existing, target, result, reversed } = args;
    if (reversed && existing) {
      this.store.put(existing);
      this.emit(existing, 'POSITION_CLOSED', fill.fillId, { reversed: true });
      this.store.markFill(fill.fillId);
      this.store.put(target);
      this.emit(target, 'POSITION_REVERSED', fill.fillId);
      this.emit(target, 'POSITION_OPENED', fill.fillId, { reversedFrom: existing.positionId });
      forexPositionReversalTotal.inc({ symbol: target.symbol });
      forexPositionOpenedTotal.inc({ symbol: target.symbol, side: target.side });
      this.publish(target, 'fx.position');
      this.notifyLifecycle(target.accountId, existing.positionId);
      return;
    }
    this.store.markFill(fill.fillId);
    this.store.put(target);
    this.emit(target, result.eventType, fill.fillId);
    if (result.eventType === 'POSITION_OPENED') forexPositionOpenedTotal.inc({ symbol: target.symbol, side: target.side });
    if (result.eventType === 'POSITION_INCREASED') forexPositionIncreasedTotal.inc({ symbol: target.symbol });
    if (result.eventType === 'POSITION_REDUCED') forexPositionReducedTotal.inc({ symbol: target.symbol });
    if (result.eventType === 'POSITION_CLOSED') forexPositionClosedTotal.inc({ symbol: target.symbol });
    this.publish(target, 'fx.position');
    const snap = this.accountSnapshot(target.accountId);
    this.publishAccount(target.accountId, snap);
    this.notifyLifecycle(target.accountId, result.eventType === 'POSITION_CLOSED' && existing ? existing.positionId : undefined);
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
    const current = this.currentPrice(p.symbol, p.entryPrice, p.side);
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

  /**
   * Executable close for risk/exposure. LONG=BID, SHORT=ASK.
   * Mid is never used. Stale/unusable quote falls back to entry, not mid.
   */
  private currentPrice(symbol: string, fallback: string, side?: ForexPositionSide): string {
    const q = this.pricing?.getQuote(symbol);
    if (!q || !side) return fallback;
    if (q.freshness === 'STALE' || q.quality === 'STALE' || q.status !== 'TRADEABLE') return fallback;
    return executableClosePrice(side, q).price;
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
    void import('./persist.js').then((m) => m.persistPositionEvent(event));
  }

  private persist(record: ForexPositionRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js').then((m) => m.persistPosition(record));
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
