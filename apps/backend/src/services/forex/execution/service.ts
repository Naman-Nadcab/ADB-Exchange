import { randomUUID } from 'node:crypto';
import {
  forexExecutionCompletedTotal,
  forexExecutionDuplicateTotal,
  forexExecutionFailedTotal,
  forexExecutionFailoverTotal,
  forexExecutionLatency,
  forexExecutionReceivedTotal,
  forexExecutionRejectedTotal,
  forexExecutionSlippage,
  forexExecutionTimeoutTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import type { ForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import { checkPriceDeviation, checkSlippage } from './guards.js';
import type { ForexExecutionEvent, ForexExecutionRecord, ForexFill } from './models.js';
import { ForexExecutionError } from './models.js';
import { validateExecutionRequest } from './pretrade.js';
import { executionFingerprint, type ForexExecutionRequest } from './request.js';
import { assertTransition, canTransition, type ForexExecEventType, type ForexExecReason, type ForexExecutionState } from './states.js';
import { ForexExecutionStore } from './store.js';
import type { ForexExecAck, ForexExecutionVenue } from './venue.js';
import { createMockExecutionVenues } from './venues.js';

class VenueTimeoutError extends Error {
  constructor() {
    super('VENUE_TIMEOUT');
    this.name = 'VenueTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new VenueTimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export type ForexLifecyclePersistMode = 'off' | 'immediate' | 'deferred';

export class ForexExecutionService {
  private lifecyclePersist: ForexLifecyclePersistMode = 'off';

  constructor(
    private readonly pricing: ForexPricingService,
    private readonly venues: Map<string, ForexExecutionVenue>,
    readonly store: ForexExecutionStore,
    private persistEnabled = false
  ) {
    this.lifecyclePersist = persistEnabled ? 'immediate' : 'off';
  }

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
    if (!on) this.lifecyclePersist = 'off';
    else if (this.lifecyclePersist === 'off') this.lifecyclePersist = 'immediate';
  }

  setLifecyclePersist(mode: ForexLifecyclePersistMode): void {
    this.lifecyclePersist = this.persistEnabled ? mode : 'off';
  }

  get(clientExecId: string): ForexExecutionRecord | undefined {
    return this.store.getByClient(clientExecId);
  }

  recoverOpen(): ForexExecutionRecord[] {
    return this.store.listOpen();
  }

  async hydrateFromDb(): Promise<void> {
    if (!this.persistEnabled) return;
    const { loadAllExecutions } = await import('./persist.js');
    this.store.hydrate(await loadAllExecutions());
  }

  async cancel(clientExecId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const rec = this.store.getByClient(clientExecId);
    if (!rec) return { ok: false, reason: 'NOT_FOUND' };
    if (rec.status === 'FILLED' || rec.status === 'REJECTED' || rec.status === 'FAILED' || rec.status === 'CANCELLED') {
      return { ok: false, reason: 'CANCEL_NOT_SUPPORTED' };
    }
    if (!canTransition(rec.status, 'CANCEL_PENDING')) {
      return { ok: false, reason: 'CANCEL_NOT_SUPPORTED' };
    }
    const venueExecId = [...rec.attempts].reverse().find((a) => a.venueExecId)?.venueExecId;
    const venue = rec.selectedProvider ? this.venues.get(rec.selectedProvider) : undefined;
    if (!venue || !venueExecId) return { ok: false, reason: 'CANCEL_NOT_SUPPORTED' };
    this.transition(rec, 'CANCEL_PENDING');
    const ack = await venue.cancelOrder(venueExecId);
    if (!ack.cancelled) {
      if (canTransition(rec.status, 'PARTIALLY_FILLED')) this.transition(rec, 'PARTIALLY_FILLED');
      return { ok: false, reason: ack.reason ?? 'CANCEL_NOT_SUPPORTED' };
    }
    this.transition(rec, 'CANCELLED');
    this.emit(rec, 'EXECUTION_COMPLETED', { reason: 'OK', metadata: { cancelled: true } });
    return { ok: true };
  }

  async execute(req: ForexExecutionRequest): Promise<ForexExecutionRecord> {
    const started = Date.now();
    const existing = await this.claim(req);
    if (existing === 'conflict') {
      forexExecutionDuplicateTotal.inc({ result: 'conflict' });
      throw new ForexExecutionError('IDEMPOTENCY_CONFLICT', 'clientExecId reused with a different request');
    }
    if (existing) {
      forexExecutionDuplicateTotal.inc({ result: 'replay' });
      this.emit(existing, 'IDEMPOTENCY_HIT', { reason: 'DUPLICATE' });
      return existing;
    }

    const record = this.createRecord(req);
    this.store.put(record);
    forexExecutionReceivedTotal.inc({ symbol: record.request.symbol });
    this.emit(record, 'EXECUTION_RECEIVED');
    this.transition(record, 'VALIDATING');
    this.emit(record, 'VALIDATION_STARTED');

    const pre = validateExecutionRequest(req);
    if (!pre.ok) {
      return await this.finish(record, 'REJECTED', pre.reason, started);
    }
    record.request.symbol = pre.symbol;

    const { assertBrokerAdapterReadyForExecution } = await import('../adapters/execution-bridge.js');
    const adapterGate = await assertBrokerAdapterReadyForExecution();
    if (!adapterGate.ok) {
      return await this.finish(record, 'REJECTED', adapterGate.reason, started);
    }

    this.transition(record, 'ROUTING');
    const now = new Date();
    const snap = this.pricing.getRoutingSnapshot(pre.symbol, now);
    const decision = this.pricing.decideExecution({
      symbol: pre.symbol,
      side: req.side,
      volume: req.volume,
      maxSlippage: req.maxSlippage ?? forexConfig.defaultMaxSlippage,
      now,
    });
    record.routingReason = decision.routingReason;
    record.snapshotStatus = snap.status;
    record.expectedPrice = decision.expectedPrice;
    record.selectedProvider = decision.selectedProvider;

    if (snap.status === 'NO_LIQUIDITY' || !decision.selectedProvider || !decision.expectedPrice || !decision.quote) {
      this.emit(record, 'ROUTING_SELECTED', { reason: 'NO_LIQUIDITY', metadata: { status: snap.status } });
      return await this.finish(record, 'REJECTED', 'NO_LIQUIDITY', started);
    }

    const deviation = checkPriceDeviation({
      requestedPrice: req.requestedPrice,
      expectedPrice: decision.expectedPrice,
      maxDeviation: req.maxDeviation ?? forexConfig.defaultMaxDeviation,
    });
    if (!deviation.ok) {
      return await this.finish(record, 'REJECTED', deviation.reason, started, deviation.detail);
    }

    const eligible = snap.providers
      .filter((p) => p.eligible)
      .sort((a, b) => a.priority - b.priority);
    if (eligible.length === 0) {
      return await this.finish(record, 'REJECTED', 'NO_LIQUIDITY', started);
    }

    this.emit(record, 'ROUTING_SELECTED', {
      provider: decision.selectedProvider,
      metadata: { expectedPrice: decision.expectedPrice, reason: decision.routingReason },
    });

    const ordered = this.orderProviders(eligible.map((p) => p.providerCode), decision.selectedProvider);
    let remaining = fxDecimal(record.remainingVolume);

    for (let i = 0; i < ordered.length; i += 1) {
      const provider = ordered[i]!;
      if (i > 0) {
        forexExecutionFailoverTotal.inc({ from: ordered[i - 1]!, to: provider });
        this.emit(record, 'FAILOVER', { provider, metadata: { from: ordered[i - 1] } });
      }

      const liveSnap = this.pricing.getRoutingSnapshot(pre.symbol, new Date());
      const row = liveSnap.providers.find((p) => p.providerCode === provider);
      if (!row?.eligible || !row.quote) {
        if (row?.reason === 'QUOTE_STALE') {
          this.emit(record, 'VALIDATION_FAILED', { provider, reason: 'QUOTE_STALE' });
          continue;
        }
        this.emit(record, 'VALIDATION_FAILED', { provider, reason: 'PROVIDER_INELIGIBLE' });
        continue;
      }
      if (row.quote.freshness === 'STALE' || row.quote.quality === 'STALE') {
        this.emit(record, 'VALIDATION_FAILED', { provider, reason: 'QUOTE_STALE' });
        continue;
      }
      if (row.quote.quality === 'CROSSED') {
        this.emit(record, 'VALIDATION_FAILED', { provider, reason: 'QUOTE_CROSSED' });
        continue;
      }

      const expected = req.side === 'buy' ? row.quote.ask : row.quote.bid;
      record.expectedPrice = expected;
      record.selectedProvider = provider;

      const venue = this.venues.get(provider);
      if (!venue) {
        this.emit(record, 'VENUE_REJECT', { provider, reason: 'PROVIDER_INELIGIBLE' });
        continue;
      }

      const submitResult = await this.submitVenue(record, venue, provider, remaining.toFixed(), expected);
      if (submitResult === 'timeout') {
        return await this.finish(record, 'FAILED', 'VENUE_TIMEOUT', started);
      }
      if (submitResult === 'malformed') {
        return await this.finish(record, 'FAILED', 'MALFORMED_VENUE_RESPONSE', started);
      }
      if (submitResult === 'reject') {
        continue;
      }
      if (submitResult === 'slippage') {
        return await this.finish(record, 'REJECTED', 'SLIPPAGE_LIMIT', started);
      }
      if (submitResult === 'overfill') {
        return await this.finish(record, 'FAILED', 'OVERFILL', started);
      }

      remaining = fxDecimal(record.remainingVolume);
      if (!remaining.gt(0)) {
        return await this.finish(record, 'FILLED', 'OK', started);
      }

      while (remaining.gt(0)) {
        const more = await this.submitVenue(record, venue, provider, remaining.toFixed(), expected);
        if (more !== 'ok' && more !== 'partial') break;
        remaining = fxDecimal(record.remainingVolume);
        if (!remaining.gt(0)) return await this.finish(record, 'FILLED', 'OK', started);
        if (more === 'ok') break;
        if (record.attempts.filter((a) => a.provider === provider).length >= 4) break;
      }
      remaining = fxDecimal(record.remainingVolume);
      if (!remaining.gt(0)) return await this.finish(record, 'FILLED', 'OK', started);
    }

    if (fxDecimal(record.filledVolume).gt(0)) {
      return await this.finish(record, 'PARTIALLY_FILLED', 'OK', started);
    }
    return await this.finish(record, 'REJECTED', 'ALL_VENUES_REJECTED', started);
  }

  private orderProviders(codes: string[], preferred: string | null): string[] {
    if (!preferred) return codes;
    return [preferred, ...codes.filter((c) => c !== preferred)];
  }

  private async submitVenue(
    record: ForexExecutionRecord,
    venue: ForexExecutionVenue,
    provider: string,
    volume: string,
    expectedPrice: string
  ): Promise<'ok' | 'partial' | 'reject' | 'timeout' | 'malformed' | 'slippage' | 'overfill'> {
    if (canTransition(record.status, 'SUBMITTED')) {
      this.transition(record, 'SUBMITTED');
    }
    const attemptNo = record.attempts.length + 1;
    const submittedAt = new Date().toISOString();
    record.attempts.push({
      attemptNo,
      provider,
      status: 'SUBMITTED',
      venueExecId: null,
      rejectReason: null,
      submittedAt,
      completedAt: null,
    });
    this.emit(record, 'VENUE_SUBMITTED', { provider, metadata: { attemptNo, volume } });

    let ack: ForexExecAck;
    try {
      ack = await withTimeout(
        venue.placeOrder({
          clientExecId: record.clientExecId,
          symbol: record.request.symbol,
          side: record.request.side,
          volume,
          price: expectedPrice,
          providerCode: provider,
        }),
        forexConfig.executionTimeoutMs
      );
    } catch (err) {
      const attempt = record.attempts[attemptNo - 1]!;
      attempt.status = 'TIMEOUT';
      attempt.completedAt = new Date().toISOString();
      if (err instanceof VenueTimeoutError) {
        forexExecutionTimeoutTotal.inc({ provider });
        this.emit(record, 'VENUE_TIMEOUT', { provider, reason: 'VENUE_TIMEOUT' });
        return 'timeout';
      }
      attempt.status = 'MALFORMED';
      this.emit(record, 'EXECUTION_FAILED', { provider, reason: 'MALFORMED_VENUE_RESPONSE' });
      return 'malformed';
    }

    const attempt = record.attempts[attemptNo - 1]!;
    attempt.completedAt = new Date().toISOString();
    attempt.venueExecId = ack.venueOrderId;

    if (ack.status === 'rejected') {
      attempt.status = 'REJECT';
      attempt.rejectReason = ack.rejectReason;
      this.emit(record, 'VENUE_REJECT', { provider, reason: 'VENUE_REJECT', metadata: { rejectReason: ack.rejectReason } });
      return 'reject';
    }

    let filled;
    try {
      filled = fxDecimal(ack.filledVolume);
      if (!filled.isFinite() || filled.lt(0)) throw new Error('bad fill');
    } catch {
      attempt.status = 'MALFORMED';
      return 'malformed';
    }
    if (!filled.gt(0)) {
      attempt.status = 'MALFORMED';
      this.emit(record, 'EXECUTION_FAILED', { provider, reason: 'MALFORMED_VENUE_RESPONSE' });
      return 'malformed';
    }

    const remainingBefore = fxDecimal(record.remainingVolume);
    if (filled.gt(remainingBefore)) {
      attempt.status = 'MALFORMED';
      this.emit(record, 'EXECUTION_FAILED', { provider, reason: 'OVERFILL' });
      return 'overfill';
    }

    const fillPrice = ack.avgPrice ?? expectedPrice;
    const slip = checkSlippage({
      side: record.request.side,
      fillPrice,
      expectedPrice,
      maxSlippage: record.request.maxSlippage ?? forexConfig.defaultMaxSlippage,
    });
    if (!slip.ok) {
      attempt.status = 'REJECT';
      attempt.rejectReason = slip.reason;
      this.emit(record, 'VALIDATION_FAILED', { provider, reason: slip.reason, metadata: { detail: slip.detail } });
      return 'slippage';
    }

    const slipAmt = fxDecimal(fillPrice).minus(expectedPrice).abs();
    forexExecutionSlippage.set({ symbol: record.request.symbol, side: record.request.side }, Number(slipAmt.toString()));

    attempt.status = 'ACK';
    if (canTransition(record.status, 'ACKNOWLEDGED')) {
      this.transition(record, 'ACKNOWLEDGED');
    }
    this.emit(record, 'VENUE_ACK', { provider, metadata: { venueExecId: ack.venueOrderId } });

    const fill: ForexFill = {
      fillId: randomUUID(),
      executionId: record.executionId,
      clientExecId: record.clientExecId,
      venueExecId: ack.venueOrderId,
      provider,
      symbol: record.request.symbol,
      side: record.request.side,
      price: fillPrice,
      volume: filled.toFixed(),
      timestamp: ack.timestamp,
      liquiditySource: 'MOCK',
    };
    if (record.fills.some((f) => f.fillId === fill.fillId)) {
      return 'malformed';
    }
    record.fills.push(fill);
    record.filledVolume = fxDecimal(record.filledVolume).plus(filled).toFixed();
    record.remainingVolume = remainingBefore.minus(filled).toFixed();
    record.executionPrice = fillPrice;
    this.emit(record, 'FILL_RECEIVED', { provider, metadata: { fillId: fill.fillId, volume: fill.volume } });

    if (fxDecimal(record.remainingVolume).gt(0)) {
      if (canTransition(record.status, 'PARTIALLY_FILLED')) {
        this.transition(record, 'PARTIALLY_FILLED');
      }
      this.emit(record, 'PARTIAL_FILL', { provider, metadata: { remaining: record.remainingVolume } });
      return 'partial';
    }
    this.emit(record, 'FINAL_FILL', { provider });
    return 'ok';
  }

  private createRecord(req: ForexExecutionRequest): ForexExecutionRecord {
    const now = new Date().toISOString();
    return {
      executionId: randomUUID(),
      clientExecId: req.clientExecId.trim(),
      fingerprint: executionFingerprint(req),
      request: { ...req, clientExecId: req.clientExecId.trim() },
      status: 'RECEIVED',
      selectedProvider: null,
      routingReason: null,
      snapshotStatus: null,
      expectedPrice: null,
      executionPrice: null,
      requestedVolume: req.volume,
      filledVolume: '0',
      remainingVolume: req.volume,
      failureReason: null,
      source: 'SIMULATED',
      attempts: [],
      fills: [],
      events: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private async claim(req: ForexExecutionRequest): Promise<ForexExecutionRecord | 'conflict' | undefined> {
    const memory = this.store.claimIdempotency(req);
    if (memory) return memory;
    if (!this.persistEnabled) return undefined;
    const { loadExecutionByClient } = await import('./persist.js');
    const loaded = await loadExecutionByClient(req.clientExecId);
    if (!loaded) return undefined;
    this.store.put(loaded);
    return this.store.claimIdempotency(req);
  }

  private transition(record: ForexExecutionRecord, to: ForexExecutionState): void {
    assertTransition(record.status, to);
    record.status = to;
    record.updatedAt = new Date().toISOString();
  }

  private emit(
    record: ForexExecutionRecord,
    eventType: ForexExecEventType,
    extra?: { provider?: string; reason?: ForexExecReason | string; metadata?: Record<string, unknown> }
  ): void {
    const event: ForexExecutionEvent = {
      eventId: randomUUID(),
      executionId: record.executionId,
      clientExecId: record.clientExecId,
      timestamp: new Date().toISOString(),
      eventType,
      provider: extra?.provider,
      reason: extra?.reason,
      metadata: extra?.metadata,
    };
    record.events.push(event);
    record.updatedAt = event.timestamp;
    forexWsHub.publishExecution({
      source: 'SIMULATED',
      eventType,
      executionId: record.executionId,
      clientExecId: record.clientExecId,
      status: record.status,
      provider: extra?.provider,
      reason: extra?.reason,
    });
  }

  private async finish(
    record: ForexExecutionRecord,
    status: ForexExecutionState,
    reason: ForexExecReason,
    started: number,
    detail?: string
  ): Promise<ForexExecutionRecord> {
    if (record.status !== status) this.transition(record, status);
    record.failureReason = reason === 'OK' ? null : reason;
    record.updatedAt = new Date().toISOString();
    if (status === 'REJECTED') {
      this.emit(record, 'VALIDATION_FAILED', { reason, metadata: { detail } });
      forexExecutionRejectedTotal.inc({ symbol: record.request.symbol, reason });
    } else if (status === 'FAILED') {
      this.emit(record, 'EXECUTION_FAILED', { reason, metadata: { detail } });
      forexExecutionFailedTotal.inc({ symbol: record.request.symbol, reason });
    } else {
      this.emit(record, 'EXECUTION_COMPLETED', { reason: 'OK' });
      forexExecutionCompletedTotal.inc({ symbol: record.request.symbol, status });
    }
    forexExecutionLatency.observe({ symbol: record.request.symbol }, (Date.now() - started) / 1000);
    await this.flushImmediate(record);
    return record;
  }

  async persistLifecycle(record: ForexExecutionRecord, client?: import('../durability/tx.js').ForexQueryable): Promise<void> {
    if (!this.persistEnabled) return;
    const { persistExecution, persistFill, persistEvent } = await import('./persist.js');
    await persistExecution(record, client);
    for (const fill of record.fills) await persistFill(fill, client);
    const { FOREX_LIFECYCLE_EXEC_EVENTS } = await import('../durability/write-classes.js');
    for (const event of record.events) {
      if (FOREX_LIFECYCLE_EXEC_EVENTS.has(event.eventType)) await persistEvent(event, client);
    }
  }

  private async flushImmediate(record: ForexExecutionRecord): Promise<void> {
    if (this.lifecyclePersist !== 'immediate') return;
    await this.persistLifecycle(record);
  }
}

let execSingleton: ForexExecutionService | null = null;

export function getForexExecutionService(pricing: ForexPricingService): ForexExecutionService {
  if (!execSingleton) {
    execSingleton = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), true);
  }
  return execSingleton;
}

export function resetForexExecutionServiceForTests(pricing: ForexPricingService): ForexExecutionService {
  execSingleton = new ForexExecutionService(pricing, createMockExecutionVenues(), new ForexExecutionStore(), false);
  return execSingleton;
}
