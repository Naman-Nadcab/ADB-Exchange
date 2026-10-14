import { randomUUID } from 'node:crypto';
import {
  forexProtectionCancelledTotal,
  forexProtectionCreatedTotal,
  forexProtectionTriggeredTotal,
  forexTriggerRejectTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import type { ForexJournalSeverity } from '../journal/models.js';
import { recordForexJournalEvent } from '../journal/service.js';
import { isLiveForexAccount } from '../broker/account-kind.js';
import { executableQuoteForAccount } from '../broker/gateway.js';
import type { ForexOrderService } from '../orders/service.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexPricingService } from '../quotes.service.js';
import type { ForexQuoteDto } from '../types.js';
import { forexWsHub } from '../ws/hub.js';
import {
  ForexProtectionError,
  protectionFingerprint,
  publicForexProtection,
  type ForexProtectionEvent,
  type ForexProtectionRecord,
  type ForexProtectionRequest,
} from './models.js';
import { assertProtectionTransition } from './states.js';
import { ForexProtectionStore } from './store.js';
import {
  executableTriggerPrice,
  isProtectionTriggered,
  quoteKey,
  quoteUsableForTrigger,
  triggerPriceSide,
} from './trigger.js';
import { parseTrailingDistance, ratchetTrailingStop } from './trailing.js';
import { validateProtectionCreate } from './validate.js';

/** Protection lifecycle points the customer journal reports on. */
const FOREX_PROTECTION_JOURNAL: Readonly<Record<string, { severity: ForexJournalSeverity; label: string }>> = {
  PROTECTION_CREATED: { severity: 'info', label: 'created' },
  PROTECTION_MODIFIED: { severity: 'info', label: 'updated' },
  TRAILING_UPDATED: { severity: 'info', label: 'trailing moved' },
  PROTECTION_CANCELLED: { severity: 'warn', label: 'cancelled' },
  PROTECTION_TRIGGERED: { severity: 'warn', label: 'triggered' },
  PROTECTION_FILLED: { severity: 'info', label: 'filled' },
  PROTECTION_FAILED: { severity: 'error', label: 'failed' },
};

export class ForexProtectionService {
  constructor(
    readonly store: ForexProtectionStore,
    private readonly positions: ForexPositionService,
    private readonly orders: ForexOrderService,
    private readonly pricing: ForexPricingService,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  async create(accountId: string, raw: ForexProtectionRequest): Promise<ForexProtectionRecord> {
    return this.store.enqueue(accountId, () => this.createLocked(accountId, raw));
  }

  getOwned(accountId: string, protectionId: string): ForexProtectionRecord {
    const p = this.store.get(protectionId);
    if (!p || p.accountId !== accountId) throw new ForexProtectionError('PROTECTION_NOT_FOUND', 'Protection not found', 404);
    return p;
  }

  listOwned(accountId: string): ForexProtectionRecord[] {
    return this.store.listByAccount(accountId);
  }

  async update(
    accountId: string,
    protectionId: string,
    patch: { triggerPrice?: string; trailingDistance?: string | null }
  ): Promise<ForexProtectionRecord> {
    return this.store.enqueue(accountId, () => this.updateLocked(accountId, protectionId, patch));
  }

  async cancel(accountId: string, protectionId: string): Promise<ForexProtectionRecord> {
    return this.store.enqueue(accountId, async () => {
      const p = this.getOwned(accountId, protectionId);
      if (p.status === 'CANCELLED') return p;
      this.transition(p, 'CANCELLED');
      p.failureReason = null;
      this.emit(p, 'PROTECTION_CANCELLED');
      forexProtectionCancelledTotal.inc({ type: p.type });
      this.publish(p, 'fx.protection');
      return p;
    });
  }

  async evaluateQuote(quote: ForexQuoteDto): Promise<void> {
    if (!quoteUsableForTrigger(quote)) {
      forexTriggerRejectTotal.inc({ reason: quote.freshness === 'STALE' || quote.quality === 'STALE' ? 'STALE' : 'INVALID' });
      return;
    }
    const active = this.store.listActiveBySymbol(quote.symbol).filter((p) => {
      const live = isLiveForexAccount(p.accountId);
      return quote.source === 'LIVE' ? live : !live;
    });
    for (const p of active) {
      await this.store.enqueue(p.accountId, () => this.evaluateOne(p, quote));
    }
  }

  onPositionClosed(accountId: string, positionId: string): void {
    for (const p of this.store.listActiveByPosition(positionId)) {
      if (p.accountId !== accountId) continue;
      void this.cancel(accountId, p.protectionId).catch(() => undefined);
    }
  }

  recover(): ForexProtectionRecord[] {
    for (const snap of this.store.snapshot()) {
      const p = this.store.get(snap.protectionId);
      if (!p) continue;
      if (p.status === 'TRIGGERING' || p.status === 'TRIGGERED' || p.status === 'EXECUTING') {
        try {
          this.transition(p, 'FAILED');
        } catch {
          p.status = 'FAILED';
          p.updatedAt = new Date().toISOString();
        }
        p.failureReason = 'RECOVERY_FAIL_CLOSED';
        this.emit(p, 'PROTECTION_FAILED', { reason: 'RECOVERY_FAIL_CLOSED' });
        this.persist(p);
      }
    }
    return this.store.snapshot();
  }

  async hydrateFromDb(): Promise<void> {
    if (!this.persistEnabled) return;
    const { loadAllProtections } = await import('./persist.js');
    this.store.hydrate(await loadAllProtections());
    this.recover();
  }

  reconcile(accountId: string): { ok: boolean; reason: string | null } {
    for (const p of this.store.listByAccount(accountId)) {
      if (p.status === 'ACTIVE') {
        try {
          const pos = this.positions.getOwned(accountId, p.positionId);
          if (pos.status !== 'OPEN') return { ok: false, reason: 'ACTIVE_ON_CLOSED_POSITION' };
        } catch {
          return { ok: false, reason: 'POSITION_MISSING' };
        }
      }
    }
    return { ok: true, reason: null };
  }

  private async createLocked(accountId: string, raw: ForexProtectionRequest): Promise<ForexProtectionRecord> {
    const existing = this.store.getByClient(accountId, raw.clientProtectionId?.trim() ?? '');
    const position = this.positions.getOwned(accountId, raw.positionId);
    const quote = executableQuoteForAccount(this.pricing, accountId, position.symbol);
    const validated = validateProtectionCreate({
      clientProtectionId: raw.clientProtectionId,
      type: raw.type,
      triggerPrice: raw.triggerPrice,
      volume: raw.volume ?? position.volume,
      position,
      quote,
    });
    const fp = protectionFingerprint({
      type: validated.type,
      positionId: position.positionId,
      volume: validated.volume,
      triggerPrice: validated.triggerPrice,
    });
    if (existing) {
      if (existing.fingerprint !== fp) {
        throw new ForexProtectionError('IDEMPOTENCY_CONFLICT', 'clientProtectionId reused with different content', 409);
      }
      return existing;
    }
    const dup = this.store.listActiveByPosition(position.positionId).find((p) => p.type === validated.type);
    if (dup) {
      throw new ForexProtectionError('DUPLICATE_PROTECTION', `active ${validated.type} already exists on this position`, 409);
    }
    const now = new Date().toISOString();
    const rec: ForexProtectionRecord = {
      protectionId: randomUUID(),
      clientProtectionId: raw.clientProtectionId.trim(),
      accountId,
      positionId: position.positionId,
      symbol: validated.symbol,
      positionSide: position.side,
      type: validated.type,
      volume: validated.volume,
      triggerPrice: validated.triggerPrice,
      trailingDistance: validated.type === 'STOP_LOSS' ? parseTrailingDistance(raw.trailingDistance) : null,
      status: 'ACTIVE',
      fingerprint: fp,
      lastQuoteKey: null,
      lastEvalPrice: null,
      lastEvalSource: null,
      orderId: null,
      failureReason: null,
      source: 'SIMULATED',
      executionMode: 'MOCK',
      createdAt: now,
      updatedAt: now,
    };
    this.store.put(rec);
    this.persist(rec);
    this.emit(rec, 'PROTECTION_CREATED');
    forexProtectionCreatedTotal.inc({ type: rec.type });
    this.publish(rec, 'fx.protection');
    return rec;
  }

  private async updateLocked(
    accountId: string,
    protectionId: string,
    patch: { triggerPrice?: string; trailingDistance?: string | null }
  ): Promise<ForexProtectionRecord> {
    const p = this.getOwned(accountId, protectionId);
    if (p.status !== 'ACTIVE') {
      throw new ForexProtectionError('PROTECTION_NOT_ACTIVE', `Cannot modify protection in ${p.status}`, 409);
    }
    const position = this.positions.getOwned(accountId, p.positionId);
    const quote = executableQuoteForAccount(this.pricing, accountId, position.symbol);
    const nextTrail =
      patch.trailingDistance === null
        ? null
        : patch.trailingDistance !== undefined
          ? parseTrailingDistance(patch.trailingDistance)
          : p.trailingDistance ?? null;
    if (patch.trailingDistance !== undefined && patch.trailingDistance !== null && !nextTrail) {
      throw new ForexProtectionError('INVALID_TRAILING_DISTANCE', 'trailingDistance must be a positive decimal');
    }
    const nextTrigger = patch.triggerPrice != null ? String(patch.triggerPrice) : p.triggerPrice;
    const validated = validateProtectionCreate({
      clientProtectionId: p.clientProtectionId,
      type: p.type,
      triggerPrice: nextTrigger,
      volume: p.volume,
      position,
      quote,
    });
    if (p.type === 'TAKE_PROFIT' && nextTrail) {
      throw new ForexProtectionError('TRAILING_NOT_SUPPORTED', 'Trailing applies to STOP_LOSS only');
    }
    p.triggerPrice = validated.triggerPrice;
    p.trailingDistance = p.type === 'STOP_LOSS' ? nextTrail : null;
    p.fingerprint = protectionFingerprint({
      type: p.type,
      positionId: p.positionId,
      volume: p.volume,
      triggerPrice: p.triggerPrice,
    });
    p.updatedAt = new Date().toISOString();
    this.persist(p);
    this.emit(p, 'PROTECTION_MODIFIED', {
      metadata: { triggerPrice: p.triggerPrice, trailingDistance: p.trailingDistance },
    });
    this.publish(p, 'fx.protection');
    return p;
  }

  private async evaluateOne(p: ForexProtectionRecord, quote: ForexQuoteDto): Promise<void> {
    const key = quoteKey(quote);
    if (p.lastQuoteKey === key) return;
    if (p.status !== 'ACTIVE') return;
    p.lastQuoteKey = key;
    p.lastEvalPrice = executableTriggerPrice(p.positionSide, quote);
    p.lastEvalSource = triggerPriceSide(p.positionSide);
    p.updatedAt = new Date().toISOString();
    const trail = ratchetTrailingStop({ protection: p, quote });
    if (trail.moved) {
      p.triggerPrice = trail.triggerPrice;
      p.fingerprint = protectionFingerprint({
        type: p.type,
        positionId: p.positionId,
        volume: p.volume,
        triggerPrice: p.triggerPrice,
      });
      this.persist(p);
      this.emit(p, 'TRAILING_UPDATED', { quoteKey: key, metadata: { triggerPrice: p.triggerPrice, trailingDistance: p.trailingDistance } });
      this.publish(p, 'fx.protection');
    }
    if (!isProtectionTriggered(p, p.lastEvalPrice)) {
      this.emit(p, 'PROTECTION_EVALUATED', { quoteKey: key, metadata: { triggered: false } });
      return;
    }
    this.transition(p, 'TRIGGERING');
    this.emit(p, 'PROTECTION_TRIGGERING', { quoteKey: key });
    this.transition(p, 'TRIGGERED');
    this.emit(p, 'PROTECTION_TRIGGERED', { quoteKey: key });
    forexProtectionTriggeredTotal.inc({ type: p.type });
    this.publish(p, 'fx.protection.triggered');
    this.transition(p, 'EXECUTING');
    const closeSide = p.positionSide === 'long' ? 'sell' : 'buy';
    try {
      const order = await this.orders.place(p.accountId, {
        clientOrderId: `PROT-${p.protectionId}`,
        symbol: p.symbol,
        side: closeSide,
        orderType: 'market',
        volume: p.volume,
        intent: 'PROTECTION_CLOSE',
        reducePositionId: p.positionId,
      });
      p.orderId = order.orderId;
      if (order.status === 'FILLED') {
        this.transition(p, 'FILLED');
        this.emit(p, 'PROTECTION_FILLED', { metadata: { orderId: order.orderId } });
      } else {
        this.transition(p, 'FAILED');
        p.failureReason = order.failureReason ?? order.status;
        this.emit(p, 'PROTECTION_FAILED', { reason: p.failureReason });
      }
    } catch (e) {
      this.transition(p, 'FAILED');
      p.failureReason = e instanceof Error ? e.message : 'ORDER_FAILED';
      this.emit(p, 'PROTECTION_FAILED', { reason: p.failureReason });
    }
    this.publish(p, 'fx.protection');
  }

  private transition(p: ForexProtectionRecord, to: ForexProtectionRecord['status']): void {
    assertProtectionTransition(p.status, to);
    p.status = to;
    p.updatedAt = new Date().toISOString();
    this.persist(p);
  }

  private emit(p: ForexProtectionRecord, eventType: string, extra?: { quoteKey?: string; reason?: string; metadata?: Record<string, unknown> }): void {
    const event: ForexProtectionEvent = {
      eventId: randomUUID(),
      protectionId: p.protectionId,
      accountId: p.accountId,
      eventType,
      quoteKey: extra?.quoteKey,
      reason: extra?.reason,
      timestamp: new Date().toISOString(),
      metadata: extra?.metadata,
    };
    this.store.events.push(event);
    this.journal(p, event);
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistProtectionEvent(event))
      .catch(() => undefined);
  }

  private journal(p: ForexProtectionRecord, event: ForexProtectionEvent): void {
    const mapped = FOREX_PROTECTION_JOURNAL[event.eventType];
    if (!mapped) return;
    const reason = event.reason == null ? null : String(event.reason);
    recordForexJournalEvent({
      accountId: p.accountId,
      severity: mapped.severity,
      category: 'protection',
      eventType: event.eventType,
      orderId: p.orderId,
      positionId: p.positionId,
      referenceId: p.protectionId,
      message:
        `${p.type} ${p.symbol} ${p.volume} @ ${p.triggerPrice} ${mapped.label}` +
        (p.trailingDistance ? ` · trail ${p.trailingDistance}` : '') +
        (reason ? ` · ${reason}` : ''),
      metadata: {
        symbol: p.symbol,
        protectionType: p.type,
        positionSide: p.positionSide,
        volume: p.volume,
        triggerPrice: p.triggerPrice,
        trailingDistance: p.trailingDistance,
        status: p.status,
        reason,
        quoteKey: event.quoteKey ?? null,
      },
    });
    void (async () => {
      const { evaluateForexAccountEventAlerts, forexProtectionEventToAlertType } = await import('../customer/alert-engine.js');
      const alertType = forexProtectionEventToAlertType(event.eventType, p.type);
      if (!alertType) return;
      await evaluateForexAccountEventAlerts({
        accountId: p.accountId,
        alertType,
        symbol: p.symbol,
        message: `${p.type} ${event.eventType}`,
        metadata: { positionId: p.positionId, protectionId: p.protectionId, protectionType: p.type },
      });
    })();
  }

  private persist(p: ForexProtectionRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js').then((m) => m.persistProtection(p));
  }

  private publish(p: ForexProtectionRecord, type: string): void {
    forexWsHub.publishPrivate(p.accountId, type, {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      protection: publicForexProtection(p),
    });
  }
}

let singleton: ForexProtectionService | null = null;

export function getForexProtectionService(
  positions: ForexPositionService,
  orders: ForexOrderService,
  pricing: ForexPricingService
): ForexProtectionService {
  if (!singleton) {
    singleton = new ForexProtectionService(new ForexProtectionStore(), positions, orders, pricing, true);
    pricing.onAcceptedQuote((q) => {
      void singleton?.evaluateQuote(q);
    });
    positions.attachProtection(singleton);
  }
  return singleton;
}

export function peekForexProtectionService(): ForexProtectionService | null {
  return singleton;
}

export function resetForexProtectionServiceForTests(
  positions: ForexPositionService,
  orders: ForexOrderService,
  pricing: ForexPricingService
): ForexProtectionService {
  singleton = new ForexProtectionService(new ForexProtectionStore(), positions, orders, pricing, false);
  return singleton;
}
