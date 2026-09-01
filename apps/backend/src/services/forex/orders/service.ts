import { randomUUID } from 'node:crypto';
import {
  forexOrderCancelledTotal,
  forexOrderCreatedTotal,
  forexOrderFailedTotal,
  forexOrderFilledTotal,
  forexOrderIdempotencyHitTotal,
  forexOrderLatency,
  forexOrderRejectedTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { fxDecimal } from '../decimal-fx.js';
import { ForexExecutionError } from '../execution/models.js';
import type { ForexExecutionRecord, ForexFill } from '../execution/models.js';
import type { ForexExecutionService } from '../execution/service.js';
import { getForexExecutionService } from '../execution/service.js';
import { forexRiskRejectionTotal } from '../../../lib/forex-prometheus-metrics.js';
import { evaluateAccountRisk } from '../risk/engine.js';
import type { ForexPositionService } from '../positions/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import type { ForexOrderEvent, ForexOrderRecord } from './models.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import { clientExecIdForOrder, orderFingerprint, type ForexOrderRequest } from './request.js';
import {
  assertOrderTransition,
  canOrderTransition,
  type ForexOrderEventType,
  type ForexOrderReason,
  type ForexOrderState,
} from './states.js';
import { ForexOrderStore } from './store.js';
import { validateForexOrderRequest } from './validate.js';

export class ForexOrderService {
  constructor(
    private readonly execution: ForexExecutionService,
    readonly store: ForexOrderStore,
    private persistEnabled = false,
    private readonly positions?: ForexPositionService
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  async place(accountId: string, raw: ForexOrderRequest): Promise<ForexOrderRecord> {
    if (!accountId) throw new ForexOrderError('UNAUTHENTICATED', 'Authentication required', 401);
    const req: ForexOrderRequest = { ...raw, clientOrderId: raw.clientOrderId?.trim() ?? '' };
    const run = () => this.store.enqueue(accountId, req.clientOrderId, () => this.placeLocked(accountId, req));
    if (this.positions) return this.store.enqueue(accountId, '*risk*', run);
    return run();
  }

  async getOwned(accountId: string, orderId: string): Promise<ForexOrderRecord> {
    if (!accountId) throw new ForexOrderError('UNAUTHENTICATED', 'Authentication required', 401);
    const memory = this.store.get(orderId);
    if (memory) {
      if (memory.accountId !== accountId) throw new ForexOrderError('FORBIDDEN', 'Forex order not found', 404);
      return memory;
    }
    if (this.persistEnabled) {
      try {
        const { loadOrderById } = await import('./persist.js');
        const loaded = await loadOrderById(orderId);
        if (loaded) {
          this.store.put(loaded);
          if (loaded.accountId !== accountId) throw new ForexOrderError('FORBIDDEN', 'Forex order not found', 404);
          return loaded;
        }
      } catch (e) {
        if (e instanceof ForexOrderError) throw e;
      }
    }
    throw new ForexOrderError('ORDER_NOT_FOUND', 'Forex order not found', 404);
  }

  listOwned(accountId: string): ForexOrderRecord[] {
    if (!accountId) throw new ForexOrderError('UNAUTHENTICATED', 'Authentication required', 401);
    return this.store.listByAccount(accountId);
  }

  async cancel(accountId: string, orderId: string): Promise<ForexOrderRecord> {
    const order = await this.getOwned(accountId, orderId);
    if (order.status === 'CANCELLED') return order;
    if (order.status === 'FILLED') {
      throw new ForexOrderError('CANCEL_FILLED_REJECTED', 'Filled market orders cannot be cancelled', 409);
    }
    if (order.status === 'REJECTED' || order.status === 'FAILED') {
      throw new ForexOrderError('CANCEL_NOT_SUPPORTED', 'Order is already terminal', 409);
    }
    if (order.status === 'NEW' && canOrderTransition(order.status, 'CANCELLED')) {
      this.emit(order, 'ORDER_CANCEL_REQUESTED');
      this.transition(order, 'CANCELLED');
      this.emit(order, 'ORDER_CANCELLED');
      forexOrderCancelledTotal.inc({ symbol: order.symbol });
      this.publish(order, 'fx.order.cancelled');
      return order;
    }
    if (!canOrderTransition(order.status, 'CANCEL_PENDING')) {
      throw new ForexOrderError('CANCEL_NOT_SUPPORTED', `Cancel is not supported from ${order.status}`, 409);
    }

    this.emit(order, 'ORDER_CANCEL_REQUESTED');
    this.transition(order, 'CANCEL_PENDING');

    const leftover = fxDecimal(order.remainingVolume).gt(0) && fxDecimal(order.filledVolume).gt(0);
    const venue = await this.execution.cancel(order.clientExecId);
    if (!venue.ok && !leftover) {
      if (canOrderTransition(order.status, 'PARTIALLY_FILLED')) this.transition(order, 'PARTIALLY_FILLED');
      throw new ForexOrderError('CANCEL_NOT_SUPPORTED', venue.reason ?? 'Venue cancel is not supported', 409);
    }
    this.transition(order, 'CANCELLED');
    this.emit(order, 'ORDER_CANCELLED', { executionId: order.executionId ?? undefined, metadata: { venue } });
    forexOrderCancelledTotal.inc({ symbol: order.symbol });
    this.publish(order, 'fx.order.cancelled');
    return order;
  }

  recoverOpen(): ForexOrderRecord[] {
    const open = this.store.listOpen();
    for (const order of open) {
      const exec = this.execution.get(order.clientExecId);
      if (exec) this.applyExecution(order, exec, Date.now());
    }
    return open;
  }

  private async placeLocked(accountId: string, req: ForexOrderRequest): Promise<ForexOrderRecord> {
    const started = Date.now();
    const existing = await this.claim(accountId, req);
    if (existing === 'conflict') {
      forexOrderIdempotencyHitTotal.inc({ result: 'conflict' });
      throw new ForexOrderError('IDEMPOTENCY_CONFLICT', 'clientOrderId reused with a different request', 409);
    }
    if (existing) {
      forexOrderIdempotencyHitTotal.inc({ result: 'replay' });
      this.emit(existing, 'ORDER_IDEMPOTENCY_HIT', { reason: 'DUPLICATE' });
      return existing;
    }

    const order = this.createRecord(accountId, req);
    this.store.put(order);
    this.persist(order);
    forexOrderCreatedTotal.inc({ symbol: order.symbol || 'UNKNOWN' });
    this.emit(order, 'ORDER_CREATED');
    this.publish(order, 'fx.order.created');
    this.transition(order, 'VALIDATING');
    this.emit(order, 'ORDER_VALIDATION_STARTED');

    const pre = validateForexOrderRequest(req);
    if (!pre.ok) {
      return this.finish(order, 'REJECTED', pre.reason, started, pre.detail);
    }
    order.symbol = pre.symbol;
    order.request.symbol = pre.symbol;

    if (this.positions) {
      const gate = this.riskGate(accountId, pre.symbol, req.side, req.volume);
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        return this.finish(order, 'REJECTED', 'RISK_REJECTED', started, gate.reason ?? 'risk limit');
      }
    }

    this.transition(order, 'ROUTING');
    this.emit(order, 'ORDER_ROUTING');
    this.transition(order, 'SUBMITTED');
    this.emit(order, 'ORDER_SUBMITTED', { metadata: { clientExecId: order.clientExecId } });

    let exec: ForexExecutionRecord;
    try {
      exec = await this.execution.execute({
        clientExecId: order.clientExecId,
        symbol: pre.symbol,
        side: req.side,
        volume: req.volume,
        orderType: 'market',
        requestedPrice: req.requestedPrice,
        maxSlippage: req.maxSlippage,
        maxDeviation: req.maxDeviation,
        accountId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ForexExecutionError && err.reason === 'IDEMPOTENCY_CONFLICT') {
        return this.finish(order, 'FAILED', 'IDEMPOTENCY_CONFLICT', started, err.message);
      }
      const reused = this.execution.get(order.clientExecId);
      if (reused) {
        this.applyExecution(order, reused, started);
        await this.bookPositions(accountId, order, reused);
        return order;
      }
      return this.finish(order, 'FAILED', 'ORDER_FAILED', started, err instanceof Error ? err.message : 'execution failed');
    }

    try {
      this.applyExecution(order, exec, started);
      await this.bookPositions(accountId, order, exec);
    } catch (err) {
      if (err instanceof ForexOrderError && err.reason === 'OVERFILL') {
        return this.finish(order, 'FAILED', 'OVERFILL', started, err.message);
      }
      throw err;
    }
    return order;
  }

  private applyExecution(order: ForexOrderRecord, exec: ForexExecutionRecord, started: number): void {
    order.executionId = exec.executionId;
    this.applyFills(order, exec.fills);
    this.emit(order, 'ORDER_ACKNOWLEDGED', { executionId: exec.executionId });

    if (exec.status === 'FILLED') {
      this.finish(order, 'FILLED', 'OK', started);
      this.publish(order, 'fx.order.filled');
      return;
    }
    if (exec.status === 'PARTIALLY_FILLED') {
      if (canOrderTransition(order.status, 'PARTIALLY_FILLED')) this.transition(order, 'PARTIALLY_FILLED');
      this.emit(order, 'ORDER_PARTIAL_FILL', { executionId: exec.executionId });
      this.publish(order, 'fx.order.updated');
      return;
    }
    if (exec.status === 'REJECTED') {
      this.finish(order, 'REJECTED', (exec.failureReason as ForexOrderReason) ?? 'ORDER_REJECTED', started);
      return;
    }
    if (exec.status === 'FAILED') {
      this.finish(order, 'FAILED', (exec.failureReason as ForexOrderReason) ?? 'ORDER_FAILED', started);
      this.publish(order, 'fx.order.updated');
      return;
    }
    if (exec.status === 'CANCELLED') {
      if (canOrderTransition(order.status, 'CANCELLED')) this.transition(order, 'CANCELLED');
      this.emit(order, 'ORDER_CANCELLED', { executionId: exec.executionId });
    }
    this.publish(order, 'fx.order.updated');
  }

  private applyFills(order: ForexOrderRecord, fills: ForexFill[]): void {
    let filled = fxDecimal(order.filledVolume);
    const requested = fxDecimal(order.requestedVolume);
    for (const fill of fills) {
      if (order.fillIds.includes(fill.fillId)) continue;
      const vol = fxDecimal(fill.volume);
      if (!vol.isFinite() || !vol.gt(0)) continue;
      const next = filled.plus(vol);
      if (next.gt(requested)) {
        this.emit(order, 'ORDER_FAILED', { reason: 'OVERFILL', executionId: fill.executionId, metadata: { fillId: fill.fillId } });
        throw new ForexOrderError('OVERFILL', 'Fill would exceed requested volume', 409);
      }
      order.fillIds.push(fill.fillId);
      filled = next;
    }
    order.filledVolume = filled.toFixed();
    order.remainingVolume = requested.minus(filled).toFixed();
    if (fxDecimal(order.remainingVolume).lt(0)) {
      throw new ForexOrderError('OVERFILL', 'remainingVolume would be negative', 409);
    }
  }

  private riskGate(accountId: string, symbol: string, side: 'buy' | 'sell', volume: string) {
    if (!this.positions) return { ok: true, reason: null };
    const quote = getForexPricingService().getQuote(symbol);
    const px = quote ? (side === 'buy' ? quote.ask : quote.bid) : undefined;
    if (!px) return evaluateAccountRisk({ accountId, positions: this.positions.listOwned(accountId, true), proposedVolume: volume, proposedSymbol: symbol });
    const preview = this.positions.previewAfterFill({
      fillId: `preview-${accountId}-${symbol}`,
      accountId,
      symbol,
      side,
      volume,
      price: px,
      timestamp: new Date().toISOString(),
    });
    return evaluateAccountRisk({ accountId, positions: preview, proposedVolume: volume, proposedSymbol: symbol });
  }

  private async bookPositions(accountId: string, order: ForexOrderRecord, exec: ForexExecutionRecord): Promise<void> {
    if (!this.positions) return;
    const fills = exec.fills.map((f) => ({
      fillId: f.fillId,
      accountId,
      symbol: f.symbol,
      side: f.side,
      volume: f.volume,
      price: f.price,
      timestamp: f.timestamp,
      executionId: f.executionId,
      orderId: order.orderId,
    }));
    await this.positions.applyFills(fills);
  }

  private createRecord(accountId: string, req: ForexOrderRequest): ForexOrderRecord {
    const orderId = randomUUID();
    const now = new Date().toISOString();
    return {
      orderId,
      clientOrderId: req.clientOrderId,
      clientExecId: clientExecIdForOrder(orderId),
      accountId,
      fingerprint: orderFingerprint(req),
      request: { ...req },
      symbol: req.symbol,
      side: req.side,
      orderType: req.orderType,
      requestedVolume: req.volume,
      filledVolume: '0',
      remainingVolume: req.volume,
      requestedPrice: req.requestedPrice ?? null,
      maxSlippage: req.maxSlippage ?? null,
      maxDeviation: req.maxDeviation ?? null,
      status: 'NEW',
      failureReason: null,
      executionId: null,
      fillIds: [],
      source: 'SIMULATED',
      executionMode: 'MOCK',
      events: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private async claim(accountId: string, req: ForexOrderRequest): Promise<ForexOrderRecord | 'conflict' | undefined> {
    const memory = this.store.claim(accountId, req);
    if (memory) return memory;
    if (!this.persistEnabled) return undefined;
    try {
      const { loadOrderByScope } = await import('./persist.js');
      const loaded = await loadOrderByScope(accountId, req.clientOrderId);
      if (!loaded) return undefined;
      this.store.put(loaded);
      return this.store.claim(accountId, req);
    } catch {
      return undefined;
    }
  }

  private transition(order: ForexOrderRecord, to: ForexOrderState): void {
    assertOrderTransition(order.status, to);
    order.status = to;
    order.updatedAt = new Date().toISOString();
    this.persist(order);
  }

  private emit(
    order: ForexOrderRecord,
    eventType: ForexOrderEventType,
    extra?: { reason?: ForexOrderReason | string; executionId?: string; metadata?: Record<string, unknown> }
  ): void {
    const event: ForexOrderEvent = {
      eventId: randomUUID(),
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      timestamp: new Date().toISOString(),
      eventType,
      reason: extra?.reason,
      executionId: extra?.executionId ?? order.executionId ?? undefined,
      metadata: extra?.metadata,
    };
    order.events.push(event);
    order.updatedAt = event.timestamp;
    void this.persistEvent(event);
  }

  private finish(
    order: ForexOrderRecord,
    status: ForexOrderState,
    reason: ForexOrderReason | string,
    started: number,
    detail?: string
  ): ForexOrderRecord {
    if (order.status !== status) {
      if (!canOrderTransition(order.status, status)) {
        throw new ForexOrderError('INVALID_STATE_TRANSITION', `Cannot move order ${order.status} → ${status}`, 409);
      }
      this.transition(order, status);
    }
    order.failureReason = reason === 'OK' ? null : reason;
    if (status === 'REJECTED') {
      this.emit(order, 'ORDER_VALIDATION_FAILED', { reason, metadata: { detail } });
      this.emit(order, 'ORDER_REJECTED', { reason, metadata: { detail } });
      forexOrderRejectedTotal.inc({ symbol: order.symbol || 'UNKNOWN', reason: String(reason) });
      this.publish(order, 'fx.order.rejected');
    } else if (status === 'FAILED') {
      this.emit(order, 'ORDER_FAILED', { reason, metadata: { detail } });
      forexOrderFailedTotal.inc({ symbol: order.symbol || 'UNKNOWN', reason: String(reason) });
    } else if (status === 'FILLED') {
      this.emit(order, 'ORDER_FILLED', { reason: 'OK' });
      forexOrderFilledTotal.inc({ symbol: order.symbol });
    }
    this.observeLatency(order, started);
    this.persist(order);
    return order;
  }

  private observeLatency(order: ForexOrderRecord, started: number): void {
    forexOrderLatency.observe({ symbol: order.symbol || 'UNKNOWN' }, (Date.now() - started) / 1000);
  }

  private publish(order: ForexOrderRecord, type: string): void {
    forexWsHub.publishOrder(order.accountId, type, {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      event: type,
      order: publicForexOrder(order),
    });
  }

  private persist(order: ForexOrderRecord): void {
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistOrder(order))
      .catch(() => undefined);
  }

  private persistEvent(event: ForexOrderEvent): void {
    if (!this.persistEnabled) return;
    void import('./persist.js')
      .then((m) => m.persistOrderEvent(event))
      .catch(() => undefined);
  }
}

let orderSingleton: ForexOrderService | null = null;

export function getForexOrderService(): ForexOrderService {
  if (!orderSingleton) {
    const pricing = getForexPricingService();
    orderSingleton = new ForexOrderService(
      getForexExecutionService(pricing),
      new ForexOrderStore(),
      true,
      getForexPositionService(pricing)
    );
  }
  return orderSingleton;
}

export function resetForexOrderServiceForTests(
  execution: ForexExecutionService,
  positions?: ForexPositionService
): ForexOrderService {
  orderSingleton = new ForexOrderService(execution, new ForexOrderStore(), false, positions);
  return orderSingleton;
}
