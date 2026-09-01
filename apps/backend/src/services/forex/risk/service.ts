import { randomUUID } from 'node:crypto';
import {
  forexAnomalyRejectTotal,
  forexDealingRejectTotal,
  forexExposureGross,
  forexExposureNet,
  forexHaltedAccounts,
  forexLiquidationOnlyAccounts,
  forexMarginUtilization,
  forexRestrictedAccounts,
  forexRiskRejectionTotal,
  forexRiskStateChangeTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { forexConfig } from '../config.js';
import { isForexAccountLiquidationLocked } from '../liquidation/lock.js';
import type { ForexOrderIntent } from '../orders/request.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import { getForexDealingSnapshot } from './dealing.js';
import { calculateForexExposure } from './exposure.js';
import type { ForexAccountRiskRecord, ForexPreTradeDecision, ForexRiskEvent } from './models.js';
import { resolveEffectiveLimits, snapshotForexRiskPolicy } from './policy.js';
import { deriveAccountRiskState, evaluatePreTradeRisk } from './pretrade.js';
import { assertAccountRiskTransition, type ForexAccountRiskState } from './states.js';
import { ForexRiskStore } from './store.js';

export class ForexRiskService {
  constructor(
    readonly store: ForexRiskStore,
    private positions: ForexPositionService,
    private pricing: ForexPricingService,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  rebind(positions: ForexPositionService, pricing: ForexPricingService): void {
    this.positions = positions;
    this.pricing = pricing;
  }

  syncState(accountId: string): ForexAccountRiskRecord {
    const positions = this.positions.listOwned(accountId, true);
    const inputs = this.positions.riskAccountingInputs(accountId);
    const dealing = getForexDealingSnapshot(accountId, positions[0]?.symbol ?? 'EURUSD');
    const limits = resolveEffectiveLimits({ symbol: positions[0]?.symbol ?? 'EURUSD', accountId });
    const derived = deriveAccountRiskState({
      accountingAvailable: inputs?.accountingAvailable,
      equity: inputs?.equity,
      positions,
      liquidationLocked: isForexAccountLiquidationLocked(accountId),
      emergencyHalt: dealing.emergencyHalt,
      tradingDisabled: limits.tradingDisabled,
      killSwitch: forexConfig.killSwitch,
      accountEnabled: dealing.account.enabled,
    });
    const prev = this.store.get(accountId);
    const now = new Date().toISOString();
    if (!prev) {
      const rec: ForexAccountRiskRecord = { accountId, state: derived.state, reason: derived.reason, updatedAt: now };
      this.store.put(rec);
      this.emit(accountId, 'RISK_STATE_CHANGED', { toState: derived.state, reason: derived.reason });
      this.observeStates();
      this.publish(accountId);
      return rec;
    }
    if (prev.state !== derived.state) {
      assertAccountRiskTransition(prev.state, derived.state);
      const from = prev.state;
      prev.state = derived.state;
      prev.reason = derived.reason;
      prev.updatedAt = now;
      this.store.put(prev);
      this.persist(prev);
      this.emit(accountId, 'RISK_STATE_CHANGED', { fromState: from, toState: derived.state, reason: derived.reason });
      forexRiskStateChangeTotal.inc({ from, to: derived.state });
      this.observeStates();
      this.publish(accountId);
    }
    return prev;
  }

  evaluateOrder(args: {
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    volume: string;
    intent?: ForexOrderIntent;
    requestedPrice?: string;
    maxDeviation?: string;
    openOrdersForSymbol: number;
  }): ForexPreTradeDecision {
    const current = this.positions.listOwned(args.accountId, true);
    const quote = this.pricing.getQuote(args.symbol);
    const px = quote ? (args.side === 'buy' ? quote.ask : quote.bid) : undefined;
    const preview = px
      ? this.positions.previewAfterFill({
          fillId: `risk-preview-${args.accountId}-${args.symbol}`,
          accountId: args.accountId,
          symbol: args.symbol,
          side: args.side,
          volume: args.volume,
          price: px,
          timestamp: new Date().toISOString(),
        })
      : current;
    const inputs = this.positions.riskAccountingInputs(args.accountId);
    const decision = evaluatePreTradeRisk({
      accountId: args.accountId,
      symbol: args.symbol,
      side: args.side,
      volume: args.volume,
      intent: args.intent,
      quote,
      currentPositions: current,
      previewPositions: preview,
      allOpenPositions: this.positions.store.listOpen(),
      openOrdersForSymbol: args.openOrdersForSymbol,
      equity: inputs?.equity,
      accountingAvailable: inputs?.accountingAvailable,
      requestedPrice: args.requestedPrice,
      maxDeviation: args.maxDeviation,
    });
    this.syncState(args.accountId);
    if (!decision.ok) {
      forexRiskRejectionTotal.inc({ reason: decision.reason ?? 'RISK_REJECTED' });
      if (decision.reason === 'STALE_MARKET' || decision.reason === 'CROSSED_QUOTE' || decision.reason === 'EXCESSIVE_SPREAD' || decision.reason === 'PRICE_DEVIATION_LIMIT' || decision.reason === 'INVALID_PRICE') {
        forexAnomalyRejectTotal.inc({ reason: decision.reason });
      }
      if (decision.reason === 'FOREX_HALTED' || decision.reason === 'INSTRUMENT_HALTED' || decision.reason === 'BUY_DISABLED' || decision.reason === 'SELL_DISABLED' || decision.reason === 'NEW_ORDERS_DISABLED') {
        forexDealingRejectTotal.inc({ reason: decision.reason });
      }
      this.emit(args.accountId, 'ORDER_RISK_REJECTED', { reason: decision.reason, metadata: { symbol: args.symbol, side: args.side } });
    }
    const exp = calculateForexExposure(current);
    forexExposureGross.set({ account: args.accountId }, Number(exp.accountGross));
    forexExposureNet.set({ account: args.accountId }, Number(exp.accountNet));
    const dec = this.positions.riskSnapshot(args.accountId);
    forexMarginUtilization.set({ account: args.accountId }, Number(dec.marginUtilization));
    return decision;
  }

  status(accountId: string) {
    const rec = this.syncState(accountId);
    const positions = this.positions.listOwned(accountId, true);
    const symbol = positions[0]?.symbol ?? 'EURUSD';
    const exp = calculateForexExposure(positions);
    const snap = this.positions.accountSnapshot(accountId);
    return {
      source: 'SIMULATED' as const,
      executionMode: 'MOCK' as const,
      valuationKind: 'CALCULATED' as const,
      state: rec.state,
      reason: rec.reason,
      liquidationLock: isForexAccountLiquidationLocked(accountId),
      dealing: getForexDealingSnapshot(accountId, symbol),
      limits: resolveEffectiveLimits({ symbol, accountId }),
      exposure: exp,
      margin: {
        equity: snap.equityReference,
        usedMargin: snap.usedMargin,
        maintenanceMargin: snap.maintenanceMargin,
        freeMargin: snap.freeMargin,
        marginUtilization: this.positions.riskSnapshot(accountId).marginUtilization,
        marginLevel: snap.marginLevel,
      },
      policy: snapshotForexRiskPolicy(),
      updatedAt: rec.updatedAt,
    };
  }

  exposure(accountId: string) {
    const positions = this.positions.listOwned(accountId, true);
    const exp = calculateForexExposure(positions);
    return { source: 'SIMULATED' as const, executionMode: 'MOCK' as const, valuationKind: 'CALCULATED' as const, accountId, ...exp };
  }

  recover(): ForexAccountRiskRecord[] {
    return this.store.snapshot();
  }

  async hydrateFromDb(): Promise<void> {
    if (!this.persistEnabled) return;
    const { loadAllAccountRiskStates } = await import('./persist.js');
    this.store.hydrate(await loadAllAccountRiskStates());
  }

  private emit(
    accountId: string,
    eventType: string,
    extra?: { reason?: string | null; fromState?: ForexAccountRiskState; toState?: ForexAccountRiskState; metadata?: Record<string, unknown> }
  ): void {
    const event: ForexRiskEvent = {
      eventId: randomUUID(),
      accountId,
      eventType,
      reason: extra?.reason ?? null,
      fromState: extra?.fromState,
      toState: extra?.toState,
      timestamp: new Date().toISOString(),
      metadata: extra?.metadata,
    };
    this.store.events.push(event);
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistRiskEvent(event))
      .catch(() => undefined);
  }

  private persist(row: ForexAccountRiskRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistAccountRiskState(row))
      .catch(() => undefined);
  }

  private publish(accountId: string): void {
    const rec = this.store.get(accountId);
    const payload = { source: 'SIMULATED', executionMode: 'MOCK', risk: rec };
    forexWsHub.publishPrivate(accountId, 'fx.risk', payload);
    forexWsHub.publishPrivate(accountId, 'fx.exposure', { source: 'SIMULATED', exposure: this.exposure(accountId) });
    forexWsHub.publishPrivate(accountId, 'fx.dealing', { source: 'SIMULATED', dealing: getForexDealingSnapshot(accountId, 'EURUSD') });
    if (rec && (rec.state === 'RESTRICTED' || rec.state === 'LIQUIDATION_ONLY' || rec.state === 'HALTED')) {
      forexWsHub.publishPrivate(accountId, 'fx.restriction', { source: 'SIMULATED', state: rec.state, reason: rec.reason });
    }
  }

  private observeStates(): void {
    let restricted = 0;
    let liqOnly = 0;
    let halted = 0;
    for (const r of this.store.byAccount.values()) {
      if (r.state === 'RESTRICTED') restricted += 1;
      if (r.state === 'LIQUIDATION_ONLY') liqOnly += 1;
      if (r.state === 'HALTED') halted += 1;
    }
    forexRestrictedAccounts.set({}, restricted);
    forexLiquidationOnlyAccounts.set({}, liqOnly);
    forexHaltedAccounts.set({}, halted);
  }
}

let singleton: ForexRiskService | null = null;

export function getForexRiskService(positions: ForexPositionService, pricing: ForexPricingService): ForexRiskService {
  if (!singleton) {
    singleton = new ForexRiskService(new ForexRiskStore(), positions, pricing, false);
  } else {
    singleton.rebind(positions, pricing);
  }
  return singleton;
}

export function resetForexRiskServiceForTests(positions: ForexPositionService, pricing: ForexPricingService): ForexRiskService {
  singleton = new ForexRiskService(new ForexRiskStore(), positions, pricing, false);
  return singleton;
}
