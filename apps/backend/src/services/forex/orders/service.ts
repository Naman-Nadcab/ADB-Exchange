import { randomUUID } from 'node:crypto';
import {
  forexCancelReplaceTotal,
  forexOrderCancelledTotal,
  forexOrderCreatedTotal,
  forexOrderFailedTotal,
  forexOrderFilledTotal,
  forexOrderIdempotencyHitTotal,
  forexOrderLatency,
  forexOrderModifyTotal,
  forexOrderRejectedTotal,
  forexPendingOrders,
  forexPendingTriggeredTotal,
  forexPendingTriggerEvaluationsTotal,
  forexRiskRejectionTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { fxDecimal } from '../decimal-fx.js';
import { ForexExecutionError } from '../execution/models.js';
import type { ForexExecutionRecord, ForexFill } from '../execution/models.js';
import type { ForexExecutionService } from '../execution/service.js';
import { getForexExecutionService } from '../execution/service.js';
import { getForexRiskService } from '../risk/service.js';
import type { ForexPositionService } from '../positions/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService, type ForexPricingService } from '../quotes.service.js';
import type { ForexQuoteDto } from '../types.js';
import { forexWsHub } from '../ws/hub.js';
import type { ForexOrderEvent, ForexOrderModifyRequest, ForexOrderRecord } from './models.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import { isPendingTriggered, isPendingWorkingStatus, quoteKey, quoteUsableForTrigger } from './pending.js';
import { clientExecIdForOrder, orderFingerprint, type ForexOrderRequest } from './request.js';
import {
  assertOrderTransition,
  canOrderTransition,
  FOREX_ORDER_REASONS,
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
    private readonly positions?: ForexPositionService,
    private readonly pricing?: ForexPricingService
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
    const run = () => this.store.enqueue(accountId, orderId, () => this.cancelLocked(accountId, orderId));
    return this.store.enqueue(accountId, '*risk*', run);
  }

  async modify(accountId: string, orderId: string, patch: ForexOrderModifyRequest): Promise<ForexOrderRecord> {
    const run = () => this.store.enqueue(accountId, orderId, () => this.modifyLocked(accountId, orderId, patch));
    return this.store.enqueue(accountId, '*risk*', run);
  }

  listPending(accountId: string): ForexOrderRecord[] {
    return this.listOwned(accountId).filter((o) => isPendingWorkingStatus(o.status));
  }

  listFills(accountId: string): Array<{ fillId: string; orderId: string; symbol: string; side: string; volume: string; price: string; timestamp: string; source: 'SIMULATED' }> {
    const out = [];
    for (const order of this.listOwned(accountId)) {
      const exec = this.execution.get(order.clientExecId);
      if (!exec) continue;
      for (const f of exec.fills) {
        out.push({
          fillId: f.fillId,
          orderId: order.orderId,
          symbol: f.symbol,
          side: f.side,
          volume: f.volume,
          price: f.price,
          timestamp: f.timestamp,
          source: 'SIMULATED' as const,
        });
      }
    }
    return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  async evaluateQuote(quote: ForexQuoteDto): Promise<void> {
    forexPendingTriggerEvaluationsTotal.inc({ result: 'seen' });
    if (!quoteUsableForTrigger(quote)) {
      forexPendingTriggerEvaluationsTotal.inc({ result: 'rejected_quote' });
      return;
    }
    const pending = this.store
      .listOpen()
      .filter((o) => o.symbol === quote.symbol && isPendingWorkingStatus(o.status));
    for (const order of pending) {
      await this.store.enqueue(order.accountId, order.orderId, () => this.evaluateOne(order, quote));
    }
  }

  recoverPending(): ForexOrderRecord[] {
    const recovered: ForexOrderRecord[] = [];
    for (const order of this.store.listOpen()) {
      if (order.status !== 'TRIGGERING') continue;
      try {
        this.transition(order, 'FAILED');
      } catch {
        order.status = 'FAILED';
        order.updatedAt = new Date().toISOString();
      }
      order.failureReason = 'RECOVERY_FAIL_CLOSED';
      this.emit(order, 'ORDER_FAILED', { reason: 'RECOVERY_FAIL_CLOSED' });
      this.persist(order);
      recovered.push(order);
    }
    this.refreshPendingGauge();
    return recovered;
  }

  recoverOpen(): ForexOrderRecord[] {
    const open = this.store.listOpen();
    for (const order of open) {
      if (order.status === 'TRIGGERING') continue;
      const exec = this.execution.get(order.clientExecId);
      if (exec) this.applyExecution(order, exec, Date.now());
    }
    this.refreshPendingGauge();
    return open;
  }

  async hydrateFromDb(): Promise<void> {
    if (!this.persistEnabled) return;
    const { loadOpenOrders } = await import('./persist.js');
    this.store.hydrate(await loadOpenOrders());
    this.recoverPending();
    this.recoverOpen();
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
      const gate = this.riskGate(accountId, pre.symbol, req.side, req.volume, req.intent ?? 'CUSTOMER', this.riskRequest(req));
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        const mapped = (FOREX_ORDER_REASONS as readonly string[]).includes(gate.reason ?? '')
          ? (gate.reason as ForexOrderReason)
          : 'RISK_REJECTED';
        return this.finish(order, 'REJECTED', mapped, started, gate.reason ?? 'risk limit');
      }
    }

    if (req.orderType === 'limit' || req.orderType === 'stop') {
      this.transition(order, 'ACCEPTED');
      this.emit(order, 'ORDER_ACCEPTED');
      this.transition(order, 'PENDING');
      this.emit(order, 'ORDER_PENDING');
      this.publish(order, 'fx.order.pending');
      this.refreshPendingGauge();
      const quote = this.pricing?.getQuote(order.symbol);
      if (quote) await this.evaluateOne(order, quote, started);
      return this.store.get(order.orderId) ?? order;
    }

    return this.submitAndExecute(order, req, pre.symbol, started);
  }

  private async cancelLocked(accountId: string, orderId: string): Promise<ForexOrderRecord> {
    const order = await this.getOwned(accountId, orderId);
    if (order.status === 'CANCELLED') {
      forexCancelReplaceTotal.inc({ result: 'idempotent' });
      return order;
    }
    if (order.status === 'FILLED') {
      forexCancelReplaceTotal.inc({ result: 'filled' });
      throw new ForexOrderError('CANCEL_FILLED_REJECTED', 'Filled orders cannot be cancelled', 409);
    }
    if (order.status === 'REJECTED' || order.status === 'FAILED') {
      forexCancelReplaceTotal.inc({ result: 'terminal' });
      throw new ForexOrderError('CANCEL_NOT_SUPPORTED', 'Order is already terminal', 409);
    }
    if (order.status === 'NEW' || isPendingWorkingStatus(order.status) || order.status === 'TRIGGERING') {
      this.emit(order, 'ORDER_CANCEL_REQUESTED');
      this.transition(order, 'CANCELLED');
      this.emit(order, 'ORDER_CANCELLED');
      forexOrderCancelledTotal.inc({ symbol: order.symbol });
      forexCancelReplaceTotal.inc({ result: 'cancelled' });
      this.publish(order, 'fx.order.cancelled');
      this.refreshPendingGauge();
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
    forexCancelReplaceTotal.inc({ result: 'cancelled' });
    this.publish(order, 'fx.order.cancelled');
    return order;
  }

  private async modifyLocked(accountId: string, orderId: string, patch: ForexOrderModifyRequest): Promise<ForexOrderRecord> {
    const order = await this.getOwned(accountId, orderId);
    const key = patch.idempotencyKey?.trim();
    if (key && order.lastModifyKey === key) {
      forexOrderModifyTotal.inc({ result: 'replay' });
      return order;
    }
    if (!isPendingWorkingStatus(order.status)) {
      forexOrderModifyTotal.inc({ result: 'rejected' });
      throw new ForexOrderError('MODIFY_NOT_SUPPORTED', `Cannot modify order in ${order.status}`, 409);
    }
    if (patch.expectedVersion != null && patch.expectedVersion !== order.version) {
      forexOrderModifyTotal.inc({ result: 'conflict' });
      throw new ForexOrderError('MODIFY_VERSION_CONFLICT', 'Order version conflict', 409);
    }
    const nextReq: ForexOrderRequest = {
      ...order.request,
      volume: patch.volume ?? order.request.volume,
      requestedPrice: patch.requestedPrice ?? order.request.requestedPrice,
    };
    const pre = validateForexOrderRequest(nextReq);
    if (!pre.ok) {
      forexOrderModifyTotal.inc({ result: 'rejected' });
      throw new ForexOrderError(pre.reason, pre.detail, 400);
    }
    if (this.positions) {
      const gate = this.riskGate(accountId, pre.symbol, nextReq.side, nextReq.volume, nextReq.intent ?? 'CUSTOMER', this.riskRequest(nextReq));
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        forexOrderModifyTotal.inc({ result: 'risk' });
        throw new ForexOrderError('RISK_REJECTED', gate.reason ?? 'risk limit', 400);
      }
    }
    order.request = { ...nextReq, symbol: pre.symbol };
    order.symbol = pre.symbol;
    order.requestedVolume = nextReq.volume;
    order.remainingVolume = nextReq.volume;
    order.requestedPrice = nextReq.requestedPrice ?? null;
    order.fingerprint = orderFingerprint(order.request);
    order.version += 1;
    if (key) order.lastModifyKey = key;
    order.updatedAt = new Date().toISOString();
    this.emit(order, 'ORDER_MODIFIED', {
      metadata: { version: order.version, requestedPrice: order.requestedPrice, volume: order.requestedVolume, stopLoss: patch.stopLoss ?? null, takeProfit: patch.takeProfit ?? null },
    });
    this.persist(order);
    forexOrderModifyTotal.inc({ result: 'ok' });
    this.publish(order, 'fx.order.updated');
    return order;
  }

  private async evaluateOne(order: ForexOrderRecord, quote: ForexQuoteDto, started = Date.now()): Promise<void> {
    if (!isPendingWorkingStatus(order.status)) return;
    const key = quoteKey(quote);
    if (order.lastQuoteKey === key) {
      forexPendingTriggerEvaluationsTotal.inc({ result: 'duplicate' });
      return;
    }
    order.lastQuoteKey = key;
    if (!quoteUsableForTrigger(quote)) {
      forexPendingTriggerEvaluationsTotal.inc({ result: 'rejected_quote' });
      return;
    }
    if (!isPendingTriggered(order, quote)) {
      forexPendingTriggerEvaluationsTotal.inc({ result: 'not_met' });
      this.persist(order);
      return;
    }
    this.transition(order, 'TRIGGERING');
    this.emit(order, 'ORDER_TRIGGERING', { metadata: { quoteKey: key } });
    this.emit(order, 'ORDER_TRIGGERED', { metadata: { quoteKey: key } });
    forexPendingTriggeredTotal.inc({ symbol: order.symbol, type: order.orderType });
    this.publish(order, 'fx.order.triggered');
    this.refreshPendingGauge();

    if (this.positions) {
      const gate = this.riskGate(order.accountId, order.symbol, order.side, order.requestedVolume, order.request.intent ?? 'CUSTOMER', this.riskRequest(order.request));
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        this.finish(order, 'FAILED', 'RISK_REJECTED', started, gate.reason ?? 'risk limit');
        return;
      }
    }

    await this.submitAndExecute(order, order.request, order.symbol, started);
  }

  private async submitAndExecute(
    order: ForexOrderRecord,
    req: ForexOrderRequest,
    symbol: string,
    started: number
  ): Promise<ForexOrderRecord> {
    this.transition(order, 'ROUTING');
    this.emit(order, 'ORDER_ROUTING');
    this.transition(order, 'SUBMITTED');
    this.emit(order, 'ORDER_SUBMITTED', { metadata: { clientExecId: order.clientExecId } });

    let exec: ForexExecutionRecord;
    try {
      exec = await this.execution.execute({
        clientExecId: order.clientExecId,
        symbol,
        side: req.side,
        volume: req.volume,
        orderType: 'market',
        requestedPrice: req.orderType === 'market' ? req.requestedPrice : undefined,
        maxSlippage: req.maxSlippage,
        maxDeviation: req.orderType === 'market' ? req.maxDeviation : undefined,
        accountId: order.accountId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ForexExecutionError && err.reason === 'IDEMPOTENCY_CONFLICT') {
        return this.finish(order, 'FAILED', 'IDEMPOTENCY_CONFLICT', started, err.message);
      }
      const reused = this.execution.get(order.clientExecId);
      if (reused) {
        this.applyExecution(order, reused, started);
        await this.bookPositions(order.accountId, order, reused);
        return order;
      }
      return this.finish(order, 'FAILED', 'ORDER_FAILED', started, err instanceof Error ? err.message : 'execution failed');
    }

    try {
      this.applyExecution(order, exec, started);
      await this.bookPositions(order.accountId, order, exec);
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

  /** Pending trigger prices are not execution prices — do not apply deviation to them. */
  private riskRequest(req: ForexOrderRequest): ForexOrderRequest {
    if (req.orderType === 'limit' || req.orderType === 'stop') {
      return { ...req, requestedPrice: undefined, maxDeviation: undefined };
    }
    return req;
  }

  private riskGate(
    accountId: string,
    symbol: string,
    side: 'buy' | 'sell',
    volume: string,
    intent: import('./request.js').ForexOrderIntent = 'CUSTOMER',
    req?: import('./request.js').ForexOrderRequest
  ) {
    if (!this.positions) return { ok: true, reason: null };
    const openForSymbol = this.store.listByAccount(accountId).filter((o) => o.symbol === symbol && !['FILLED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(o.status)).length;
    const decision = getForexRiskService(this.positions, getForexPricingService()).evaluateOrder({
      accountId,
      symbol,
      side,
      volume,
      intent,
      requestedPrice: req?.requestedPrice,
      maxDeviation: req?.maxDeviation,
      openOrdersForSymbol: openForSymbol,
    });
    if (!decision.ok) return { ok: false, reason: decision.reason };
    return { ok: true, reason: null };
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
    this.publishFills(accountId, order, exec);
    await this.postFillCommissions(accountId, exec);
  }

  private publishFills(accountId: string, order: ForexOrderRecord, exec: ForexExecutionRecord): void {
    for (const f of exec.fills) {
      forexWsHub.publishPrivate(accountId, 'fx.fill', {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        fill: {
          fillId: f.fillId,
          orderId: order.orderId,
          executionId: exec.executionId,
          symbol: f.symbol,
          side: f.side,
          volume: f.volume,
          price: f.price,
          timestamp: f.timestamp,
        },
      });
    }
    forexWsHub.publishPrivate(accountId, 'fx.execution', {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      executionId: exec.executionId,
      orderId: order.orderId,
      status: exec.status,
    });
  }

  private async postFillCommissions(accountId: string, exec: ForexExecutionRecord): Promise<void> {
    if (!this.positions) return;
    try {
      const { peekForexAccountingService } = await import('../accounting/service.js');
      const acc = peekForexAccountingService();
      if (!acc) return;
      for (const f of exec.fills) {
        await acc.postCommission({
          accountId,
          fillId: f.fillId,
          symbol: f.symbol,
          side: f.side,
          volume: f.volume,
          price: f.price,
        });
      }
    } catch {
      /* accounting optional in isolated order tests */
    }
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
      version: 1,
      lastQuoteKey: null,
      lastModifyKey: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private refreshPendingGauge(): void {
    forexPendingOrders.set(this.store.listOpen().filter((o) => isPendingWorkingStatus(o.status)).length);
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
      getForexPositionService(pricing),
      pricing
    );
    pricing.onAcceptedQuote((q) => {
      void orderSingleton?.evaluateQuote(q);
    });
  }
  return orderSingleton;
}

export function resetForexOrderServiceForTests(
  execution: ForexExecutionService,
  positions?: ForexPositionService,
  pricing?: ForexPricingService
): ForexOrderService {
  orderSingleton = new ForexOrderService(execution, new ForexOrderStore(), false, positions, pricing);
  return orderSingleton;
}
