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
import { isLiveForexAccount, loadForexAccountKind } from '../broker/account-kind.js';
import { brokerOrdersReady, getBrokerGateway } from '../broker/gateway.js';
import { fxDecimal } from '../decimal-fx.js';
import { ForexExecutionError } from '../execution/models.js';
import type { ForexExecutionRecord, ForexFill } from '../execution/models.js';
import type { ForexExecutionService } from '../execution/service.js';
import { getForexExecutionService } from '../execution/service.js';
import { getForexRiskService } from '../risk/service.js';
import type { ForexPositionService } from '../positions/service.js';
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService, type ForexPricingService } from '../quotes.service.js';
import type { ForexQuoteDto } from '../types.js';
import { forexWsHub } from '../ws/hub.js';
import type { ForexOrderEvent, ForexOrderModifyRequest, ForexOrderRecord } from './models.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import {
  isForexPendingOrderType,
  isPendingTriggered,
  isPendingWorkingStatus,
  isStopLimitMarketable,
  quoteKey,
  quoteUsableForTrigger,
} from './pending.js';
import {
  clientExecIdForOrder,
  orderFingerprint,
  orderTimeInForce,
  type ForexOrderRequest,
} from './request.js';
import { FOREX_LIFECYCLE_ORDER_EVENTS } from '../durability/write-classes.js';
import { recordForexJournalEvent } from '../journal/service.js';
import type { ForexJournalInput, ForexJournalSeverity } from '../journal/models.js';
import { isPgUniqueViolation, type ForexQueryable } from '../durability/tx.js';
import {
  assertOrderTransition,
  canOrderTransition,
  FOREX_ORDER_REASONS,
  FOREX_ORDER_TERMINAL,
  type ForexOrderEventType,
  type ForexOrderReason,
  type ForexOrderState,
} from './states.js';
import { ForexOrderStore } from './store.js';
import { isForexDemoMockSessionBypassActive } from '../sessions/demo-bypass.js';
import { isForexTradingEligible } from '../sessions/eligibility.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { validateForexOrderRequest } from './validate.js';

/**
 * Lifecycle events the customer journal reports on. Everything else stays in
 * forex_order_events, which is an engineering audit trail rather than a
 * customer-facing log.
 */
const FOREX_ORDER_JOURNAL: Readonly<Record<string, { severity: ForexJournalSeverity; label: string }>> = {
  ORDER_ACCEPTED: { severity: 'info', label: 'accepted' },
  ORDER_PENDING: { severity: 'info', label: 'working' },
  ORDER_MODIFIED: { severity: 'info', label: 'modified' },
  ORDER_FILLED: { severity: 'info', label: 'filled' },
  ORDER_CANCELLED: { severity: 'warn', label: 'cancelled' },
  ORDER_REJECTED: { severity: 'error', label: 'rejected' },
  ORDER_FAILED: { severity: 'error', label: 'failed' },
};

export class ForexOrderService {
  private holdLifecyclePersist = false;

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
    if (!this.positions) return run();
    const memory = this.store.get(orderId);
    if (memory && isPendingWorkingStatus(memory.status)) return run();
    return this.store.enqueue(accountId, '*risk*', run);
  }

  async modify(accountId: string, orderId: string, patch: ForexOrderModifyRequest): Promise<ForexOrderRecord> {
    const run = () => this.store.enqueue(accountId, orderId, () => this.modifyLocked(accountId, orderId, patch));
    return this.store.enqueue(accountId, '*risk*', run);
  }

  listPending(accountId: string): ForexOrderRecord[] {
    return this.listOwned(accountId).filter((o) => isPendingWorkingStatus(o.status));
  }

  listFills(accountId: string): Array<{ fillId: string; orderId: string; symbol: string; side: string; volume: string; price: string; timestamp: string; source: 'SIMULATED' | 'LIVE' }> {
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
          source: f.liquiditySource === 'BROKER' ? ('LIVE' as const) : ('SIMULATED' as const),
        });
      }
    }
    return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  async evaluateQuote(quote: ForexQuoteDto): Promise<void> {
    await this.expireDayOrders();
    await this.expireGtdOrders();
    try {
      const { evaluateForexPriceAlertsForQuote } = await import('../customer/alerts.js');
      await evaluateForexPriceAlertsForQuote({ symbol: quote.symbol, bid: quote.bid, ask: quote.ask });
    } catch {
      /* alerts optional when DB tables not migrated */
    }
    forexPendingTriggerEvaluationsTotal.inc({ result: 'seen' });
    if (!quoteUsableForTrigger(quote)) {
      forexPendingTriggerEvaluationsTotal.inc({ result: 'rejected_quote' });
      return;
    }
    const pending = this.store.listOpen().filter((o) => {
      if (o.symbol !== quote.symbol || !isPendingWorkingStatus(o.status)) return false;
      const live = isLiveForexAccount(o.accountId);
      return quote.source === 'LIVE' ? live : !live;
    });
    for (const order of pending) {
      await this.store.enqueue(order.accountId, order.orderId, () => this.evaluateOne(order, quote));
    }
  }

  /**
   * DAY pending orders do not survive a session close. GTC/other TIFs keep the
   * pre-existing behaviour (they fail closed with SESSION_CLOSED on trigger).
   */
  async expireGtdOrders(asOf: Date = new Date()): Promise<ForexOrderRecord[]> {
    const nowMs = asOf.getTime();
    const candidates = this.store
      .listOpen()
      .filter((o) => o.timeInForce === 'GTD' && isPendingWorkingStatus(o.status));
    if (candidates.length === 0) return [];
    const expired: ForexOrderRecord[] = [];
    for (const order of candidates) {
      const exp = order.expireAt ? Date.parse(order.expireAt) : NaN;
      if (!Number.isFinite(exp) || exp > nowMs) continue;
      await this.store.enqueue(order.accountId, order.orderId, async () => {
        if (!isPendingWorkingStatus(order.status)) return;
        this.emit(order, 'ORDER_CANCEL_REQUESTED', { reason: 'GTD_ORDER_EXPIRED' });
        this.transition(order, 'CANCELLED');
        order.failureReason = 'GTD_ORDER_EXPIRED';
        this.emit(order, 'ORDER_CANCELLED', {
          reason: 'GTD_ORDER_EXPIRED',
          metadata: { timeInForce: 'GTD', expireAt: order.expireAt },
        });
        forexOrderCancelledTotal.inc({ symbol: order.symbol });
        this.publish(order, 'fx.order.cancelled');
        await this.persistNow(order);
        expired.push(order);
      });
    }
    if (expired.length > 0) this.refreshPendingGauge();
    return expired;
  }

  async expireDayOrders(): Promise<ForexOrderRecord[]> {
    const candidates = this.store
      .listOpen()
      .filter((o) => o.timeInForce === 'DAY' && isPendingWorkingStatus(o.status));
    if (candidates.length === 0) return [];
    const session = isForexTradingEligible();
    if (session.open) return [];
    const expired: ForexOrderRecord[] = [];
    for (const order of candidates) {
      await this.store.enqueue(order.accountId, order.orderId, async () => {
        if (!isPendingWorkingStatus(order.status)) return;
        this.emit(order, 'ORDER_CANCEL_REQUESTED', { reason: 'DAY_ORDER_EXPIRED' });
        this.transition(order, 'CANCELLED');
        order.failureReason = 'DAY_ORDER_EXPIRED';
        this.emit(order, 'ORDER_CANCELLED', {
          reason: 'DAY_ORDER_EXPIRED',
          metadata: { timeInForce: 'DAY', session: session.reason },
        });
        forexOrderCancelledTotal.inc({ symbol: order.symbol });
        this.publish(order, 'fx.order.cancelled');
        await this.persistNow(order);
        expired.push(order);
      });
    }
    if (expired.length > 0) this.refreshPendingGauge();
    return expired;
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
      void this.persistNow(order);
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
      if (!exec) continue;
      this.holdLifecyclePersist = true;
      try {
        order.executionId = exec.executionId;
        this.applyFills(order, exec.fills);
        if (exec.status === 'FILLED' && canOrderTransition(order.status, 'FILLED')) this.transition(order, 'FILLED');
        else if (exec.status === 'PARTIALLY_FILLED' && canOrderTransition(order.status, 'PARTIALLY_FILLED')) {
          this.transition(order, 'PARTIALLY_FILLED');
        }
      } finally {
        this.holdLifecyclePersist = false;
      }
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
      return this.resumeExisting(existing, req);
    }

    const order = this.createRecord(accountId, req);
    this.store.put(order);
    try {
      await this.persistNow(order);
    } catch (err) {
      if (this.persistEnabled && isPgUniqueViolation(err)) {
        const loaded = await this.reloadByScope(accountId, req.clientOrderId);
        if (loaded) return this.resumeExisting(loaded, req);
      }
      if (this.persistEnabled) {
        throw new ForexOrderError('ORDER_PERSIST_FAILED', 'Failed to persist Forex order', 503);
      }
    }
    forexOrderCreatedTotal.inc({ symbol: order.symbol || 'UNKNOWN' });
    this.emit(order, 'ORDER_CREATED');
    this.publish(order, 'fx.order.created');
    this.transition(order, 'VALIDATING');
    this.emit(order, 'ORDER_VALIDATION_STARTED');

    const pre = validateForexOrderRequest(req);
    if (!pre.ok) {
      return await this.finish(order, 'REJECTED', pre.reason, started, pre.detail);
    }
    order.symbol = pre.symbol;
    order.request.symbol = pre.symbol;

    const kind = await loadForexAccountKind(accountId);
    if (kind === 'LIVE') {
      order.source = 'LIVE';
      order.executionMode = 'BROKER';
      const gateway = getBrokerGateway();
      const health = await gateway.health();
      if (!brokerOrdersReady(health)) {
        return await this.finish(order, 'REJECTED', 'LIVE_BROKER_UNAVAILABLE', started, 'Broker gateway is not ready');
      }
      await gateway.refreshQuotes([pre.symbol]);
      const liveQuote = gateway.getQuote(pre.symbol);
      if (!quoteUsableForTrigger(liveQuote)) {
        return await this.finish(order, 'REJECTED', 'STALE_MARKET', started, 'Broker quote is missing or stale');
      }
    }

    if (this.positions) {
      const gate = this.riskGate(accountId, pre.symbol, req.side, req.volume, req.intent ?? 'CUSTOMER', this.riskRequest(req));
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        const mapped = (FOREX_ORDER_REASONS as readonly string[]).includes(gate.reason ?? '')
          ? (gate.reason as ForexOrderReason)
          : 'RISK_REJECTED';
        return await this.finish(order, 'REJECTED', mapped, started, gate.reason ?? 'risk limit');
      }
    }

    if (isForexPendingOrderType(req.orderType)) {
      this.transition(order, 'ACCEPTED');
      this.emit(order, 'ORDER_ACCEPTED');
      this.transition(order, 'PENDING');
      this.emit(order, 'ORDER_PENDING');
      await this.persistNow(order);
      await this.persistPending(order);
      this.publish(order, 'fx.order.pending');
      this.refreshPendingGauge();
      const quote = isLiveForexAccount(accountId)
        ? getBrokerGateway().getQuote(order.symbol)
        : this.pricing?.getQuote(order.symbol);
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
      await this.persistNow(order);
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
    await this.persistNow(order);
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
      limitPrice: patch.limitPrice !== undefined ? patch.limitPrice || undefined : order.request.limitPrice,
      stopLoss: patch.stopLoss !== undefined ? patch.stopLoss || undefined : order.request.stopLoss,
      takeProfit: patch.takeProfit !== undefined ? patch.takeProfit || undefined : order.request.takeProfit,
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
    order.limitPrice = nextReq.limitPrice ?? null;
    order.fingerprint = orderFingerprint(order.request);
    order.version += 1;
    if (key) order.lastModifyKey = key;
    order.updatedAt = new Date().toISOString();
    this.emit(order, 'ORDER_MODIFIED', {
      metadata: { version: order.version, requestedPrice: order.requestedPrice, limitPrice: order.limitPrice, volume: order.requestedVolume, stopLoss: patch.stopLoss ?? null, takeProfit: patch.takeProfit ?? null },
    });
    await this.persistNow(order);
    await this.persistPending(order);
    if (this.persistEnabled) {
      const { persistOrderModification } = await import('../advanced/persist.js');
      await persistOrderModification({
        eventId: randomUUID(),
        orderId: order.orderId,
        accountId,
        fromVersion: order.version - 1,
        toVersion: order.version,
        requestedPrice: order.requestedPrice,
        volume: order.requestedVolume,
        idempotencyKey: key ?? null,
        metadata: { stopLoss: patch.stopLoss ?? null, takeProfit: patch.takeProfit ?? null },
      });
    }
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
      await this.persistNow(order);
      return;
    }
    const instrument = getForexInstrumentBySymbol(order.symbol);
    if (!instrument || instrument.tradingStatus !== 'active') {
      await this.finish(order, 'FAILED', 'INSTRUMENT_HALTED', started, 'instrument not executable');
      return;
    }
    const session = isForexTradingEligible();
    const demoBypass = isForexDemoMockSessionBypassActive();
    if (!session.open && (order.request.intent ?? 'CUSTOMER') === 'CUSTOMER' && !demoBypass) {
      await this.finish(order, 'FAILED', session.reason === 'HOLIDAY_UNCONFIGURED' ? 'HOLIDAY_UNCONFIGURED' : 'SESSION_CLOSED', started, session.reason);
      return;
    }
    if (order.orderType === 'stop_limit') {
      const limitPrice = order.limitPrice ?? order.request.limitPrice ?? null;
      if (limitPrice == null || limitPrice === '') {
        await this.finish(order, 'FAILED', 'INVALID_LIMIT_PRICE', started, 'stop_limit is missing limitPrice');
        return;
      }
      // Stop is hit. Fill now only if the limit is already marketable, otherwise
      // the order keeps working as a plain pending limit at the limit price.
      if (!isStopLimitMarketable(order.side, limitPrice, quote)) {
        await this.activateStopLimit(order, limitPrice, quote);
        return;
      }
    }
    this.transition(order, 'TRIGGERING');
    this.emit(order, 'ORDER_TRIGGERING', { metadata: { quoteKey: key } });
    this.emit(order, 'ORDER_TRIGGERED', { metadata: { quoteKey: key } });
    forexPendingTriggeredTotal.inc({ symbol: order.symbol, type: order.orderType });
    this.publish(order, 'fx.order.triggered');
    this.refreshPendingGauge();

    if (this.positions) {
      const gate = this.riskGate(
        order.accountId,
        order.symbol,
        order.side,
        order.requestedVolume,
        order.request.intent ?? 'CUSTOMER',
        this.riskRequest(order.request),
        isLiveForexAccount(order.accountId) ? quote : undefined
      );
      if (!gate.ok) {
        forexRiskRejectionTotal.inc({ reason: gate.reason ?? 'RISK_REJECTED' });
        await this.finish(order, 'FAILED', 'RISK_REJECTED', started, gate.reason ?? 'risk limit');
        return;
      }
    }

    await this.submitAndExecute(order, order.request, order.symbol, started);
  }

  /**
   * stop_limit stop hit while the limit is not yet marketable: rewrite the
   * working order into a pending limit at limitPrice and let the existing limit
   * trigger path take it from here. The idempotency fingerprint is deliberately
   * left untouched so replays of the original stop_limit request still resolve.
   */
  private async activateStopLimit(order: ForexOrderRecord, limitPrice: string, quote: ForexQuoteDto): Promise<void> {
    const stopPrice = order.requestedPrice;
    order.orderType = 'limit';
    order.request = { ...order.request, orderType: 'limit', requestedPrice: limitPrice };
    order.requestedPrice = limitPrice;
    order.limitPrice = limitPrice;
    order.version += 1;
    order.updatedAt = new Date().toISOString();
    forexPendingTriggeredTotal.inc({ symbol: order.symbol, type: 'stop_limit' });
    this.emit(order, 'ORDER_TRIGGERED', {
      reason: 'STOP_LIMIT_ACTIVATED',
      metadata: { quoteKey: quoteKey(quote), from: 'stop_limit', to: 'limit', stopPrice, limitPrice },
    });
    this.emit(order, 'ORDER_MODIFIED', {
      metadata: { version: order.version, requestedPrice: limitPrice, reason: 'STOP_LIMIT_ACTIVATED' },
    });
    await this.persistNow(order);
    await this.persistPending(order);
    this.publish(order, 'fx.order.triggered');
    this.publish(order, 'fx.order.updated');
    this.refreshPendingGauge();
  }

  private async submitAndExecute(
    order: ForexOrderRecord,
    req: ForexOrderRequest,
    symbol: string,
    started: number
  ): Promise<ForexOrderRecord> {
    if (order.timeInForce === 'FOK' && !this.canFillFullVolume(order, symbol)) {
      return await this.finish(order, 'REJECTED', 'FOK_UNFILLABLE', started, 'full requested volume is not fillable');
    }
    this.transition(order, 'ROUTING');
    this.emit(order, 'ORDER_ROUTING');
    this.transition(order, 'SUBMITTED');
    this.emit(order, 'ORDER_SUBMITTED', { metadata: { clientExecId: order.clientExecId } });

    if (isLiveForexAccount(order.accountId)) {
      return this.executeOnBroker(order, req, symbol, started);
    }

    let exec: ForexExecutionRecord;
    const prevPersist = this.persistEnabled ? 'deferred' : 'off';
    this.execution.setLifecyclePersist(prevPersist);
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
      this.execution.setLifecyclePersist(this.persistEnabled ? 'immediate' : 'off');
      if (err instanceof ForexExecutionError && err.reason === 'IDEMPOTENCY_CONFLICT') {
        return await this.finish(order, 'FAILED', 'IDEMPOTENCY_CONFLICT', started, err.message);
      }
      const reused = this.execution.get(order.clientExecId);
      if (reused) {
        await this.commitExecutionLifecycle(order, reused, started);
        return order;
      }
      return await this.finish(order, 'FAILED', 'ORDER_FAILED', started, err instanceof Error ? err.message : 'execution failed');
    }
    this.execution.setLifecyclePersist(this.persistEnabled ? 'immediate' : 'off');

    try {
      await this.commitExecutionLifecycle(order, exec, started);
    } catch (err) {
      if (err instanceof ForexOrderError && err.reason === 'OVERFILL') {
        return await this.finish(order, 'FAILED', 'OVERFILL', started, err.message);
      }
      throw err;
    }
    return order;
  }

  /**
   * Project execution onto a working copy, persist order+execution+book in one
   * TX when persist is on, then adopt into memory only after COMMIT.
   */
  private async commitExecutionLifecycle(
    order: ForexOrderRecord,
    exec: ForexExecutionRecord,
    started: number
  ): Promise<void> {
    const seen = new Set(order.events.map((e) => e.eventId));
    const working = this.cloneOrder(order);
    this.holdLifecyclePersist = true;
    try {
      await this.applyExecution(working, exec, started);
    } finally {
      this.holdLifecyclePersist = false;
    }
    await this.bookPositions(order.accountId, working, exec);
    this.adoptOrder(order, working);
    for (const event of order.events) {
      if (!seen.has(event.eventId)) this.journal(order, event);
    }
  }

  private async applyExecution(order: ForexOrderRecord, exec: ForexExecutionRecord, started: number): Promise<void> {
    order.executionId = exec.executionId;
    this.applyFills(order, exec.fills);
    this.emit(order, 'ORDER_ACKNOWLEDGED', { executionId: exec.executionId });

    if (exec.status === 'FILLED') {
      await this.finish(order, 'FILLED', 'OK', started);
      this.publish(order, 'fx.order.filled');
      return;
    }
    if (exec.status === 'PARTIALLY_FILLED') {
      if (canOrderTransition(order.status, 'PARTIALLY_FILLED')) this.transition(order, 'PARTIALLY_FILLED');
      this.emit(order, 'ORDER_PARTIAL_FILL', { executionId: exec.executionId });
      if (this.cancelPartialRemainder(order, exec)) return;
      this.publish(order, 'fx.order.updated');
      return;
    }
    if (exec.status === 'REJECTED') {
      await this.finish(order, 'REJECTED', (exec.failureReason as ForexOrderReason) ?? 'ORDER_REJECTED', started);
      return;
    }
    if (exec.status === 'FAILED') {
      await this.finish(order, 'FAILED', (exec.failureReason as ForexOrderReason) ?? 'ORDER_FAILED', started);
      this.publish(order, 'fx.order.updated');
      return;
    }
    if (exec.status === 'CANCELLED') {
      if (canOrderTransition(order.status, 'CANCELLED')) this.transition(order, 'CANCELLED');
      this.emit(order, 'ORDER_CANCELLED', { executionId: exec.executionId });
    }
    this.publish(order, 'fx.order.updated');
  }

  /**
   * IOC/FOK leave nothing working: any unfilled remainder is cancelled instead
   * of resting. Returns true when the order reached CANCELLED.
   */
  private cancelPartialRemainder(order: ForexOrderRecord, exec: ForexExecutionRecord): boolean {
    const tif = order.timeInForce;
    if (tif !== 'IOC' && tif !== 'FOK') return false;
    if (!fxDecimal(order.remainingVolume).gt(0)) return false;
    if (canOrderTransition(order.status, 'CANCEL_PENDING')) this.transition(order, 'CANCEL_PENDING');
    if (!canOrderTransition(order.status, 'CANCELLED')) return false;
    this.transition(order, 'CANCELLED');
    order.failureReason = tif === 'IOC' ? 'IOC_REMAINDER_CANCELLED' : 'FOK_PARTIAL_CANCELLED';
    this.emit(order, 'ORDER_CANCELLED', {
      reason: order.failureReason,
      executionId: exec.executionId,
      metadata: { timeInForce: tif, remainingVolume: order.remainingVolume },
    });
    forexOrderCancelledTotal.inc({ symbol: order.symbol });
    this.publish(order, 'fx.order.cancelled');
    return true;
  }

  /**
   * LIVE fills are broker prints. MOCK venues are not asked.
   */
  private async executeOnBroker(
    order: ForexOrderRecord,
    req: ForexOrderRequest,
    symbol: string,
    started: number
  ): Promise<ForexOrderRecord> {
    const gateway = getBrokerGateway();
    const health = await gateway.health();
    if (!brokerOrdersReady(health)) {
      return await this.finish(order, 'REJECTED', 'LIVE_BROKER_UNAVAILABLE', started, 'Broker gateway is not ready');
    }
    await gateway.refreshQuotes([symbol]);
    if (!quoteUsableForTrigger(gateway.getQuote(symbol))) {
      return await this.finish(order, 'REJECTED', 'STALE_MARKET', started, 'Broker quote is missing or stale');
    }
    const placed = await gateway.placeOrder({
      clientOrderId: order.clientExecId,
      accountId: order.accountId,
      symbol,
      side: req.side,
      volume: order.remainingVolume,
      price: req.requestedPrice,
    });
    if (placed.status !== 'filled' || !placed.avgPrice) {
      const reason = placed.reason === 'LIVE_BROKER_UNAVAILABLE' ? 'LIVE_BROKER_UNAVAILABLE' : 'BROKER_REJECTED';
      return await this.finish(order, 'REJECTED', reason, started, placed.reason ?? 'Broker rejected the order');
    }
    let exec: ForexExecutionRecord;
    try {
      exec = await this.execution.recordBrokerFill({
        clientExecId: order.clientExecId,
        accountId: order.accountId,
        symbol,
        side: req.side,
        requestedVolume: order.requestedVolume,
        filledVolume: placed.filledVolume,
        price: placed.avgPrice,
        venueOrderId: placed.venueOrderId,
      });
    } catch (err) {
      return await this.finish(order, 'FAILED', 'ORDER_FAILED', started, err instanceof Error ? err.message : 'broker fill failed');
    }
    try {
      await this.commitExecutionLifecycle(order, exec, started);
    } catch (err) {
      if (err instanceof ForexOrderError && err.reason === 'OVERFILL') {
        return await this.finish(order, 'FAILED', 'OVERFILL', started, err.message);
      }
      throw err;
    }
    return this.store.get(order.orderId) ?? order;
  }

  /**
   * FOK needs an all-or-nothing decision before routing. MOCK liquidity covers
   * the full requested volume for any quotable symbol. LIVE uses the broker quote only.
   */
  private canFillFullVolume(order: ForexOrderRecord, symbol: string): boolean {
    if (!fxDecimal(order.remainingVolume).gt(0)) return false;
    if (isLiveForexAccount(order.accountId)) return quoteUsableForTrigger(getBrokerGateway().getQuote(symbol));
    if (!this.pricing) return true;
    return this.pricing.getQuote(symbol) != null;
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
    if (isForexPendingOrderType(req.orderType)) {
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
    req?: import('./request.js').ForexOrderRequest,
    quote?: ForexQuoteDto
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
      reducePositionId: req?.reducePositionId,
      ...(quote ? { quote } : {}),
    });
    if (!decision.ok) return { ok: false, reason: decision.reason };
    return { ok: true, reason: null };
  }

  private async bookPositions(accountId: string, order: ForexOrderRecord, exec: ForexExecutionRecord): Promise<void> {
    if (!this.positions) {
      if (this.persistEnabled) await this.persistLifecycleInTx(order, exec);
      return;
    }
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
      intent: order.request.intent ?? 'CUSTOMER',
      reducePositionId: order.request.reducePositionId,
    }));
    if (this.persistEnabled && fills.length === 0) {
      await this.persistLifecycleInTx(order, exec);
      return;
    }
    if (this.positions && this.persistEnabled) {
      await this.positions.applyFillsInTransaction(
        fills,
        async (input, client) => {
          const { peekForexAccountingService } = await import('../accounting/service.js');
          const acc = peekForexAccountingService();
          if (!acc) return;
          return acc.postCommission(
            {
              accountId,
              fillId: input.fillId,
              symbol: input.symbol,
              side: input.side,
              volume: input.volume,
              price: input.price,
            },
            client
          );
        },
        async (client) => {
          await this.persistLifecycleInTx(order, exec, client);
        }
      );
    } else {
      await this.positions.applyFills(fills);
      await this.postFillCommissions(accountId, exec);
      if (this.persistEnabled) await this.persistLifecycleInTx(order, exec);
    }
    this.publishFills(accountId, order, exec);
    await this.attachPendingProtections(accountId, order);
  }

  private async attachPendingProtections(accountId: string, order: ForexOrderRecord): Promise<void> {
    const sl = order.request.stopLoss?.trim();
    const tp = order.request.takeProfit?.trim();
    if ((!sl && !tp) || !this.positions) return;
    // Prefer the position that received this order's fill (HEDGING-safe).
    const open =
      this.positions
        .listOwned(accountId, true)
        .find(
          (p) =>
            p.symbol === order.symbol &&
            p.status === 'OPEN' &&
            p.appliedFills.some((f) => f.orderId === order.orderId)
        ) ??
      this.positions.listOwned(accountId, true).find((p) => p.symbol === order.symbol && p.status === 'OPEN');
    if (!open) return;
    const { getForexProtectionService } = await import('../protection/service.js');
    const prot = getForexProtectionService(this.positions, this, getForexPricingService());
    if (sl) {
      try {
        await prot.create(accountId, {
          clientProtectionId: `ord-sl-${order.orderId.slice(0, 12)}`,
          positionId: open.positionId,
          type: 'STOP_LOSS',
          triggerPrice: sl,
        });
      } catch {
        /* duplicate or invalid — leave position open; user can set SL */
      }
    }
    if (tp) {
      try {
        await prot.create(accountId, {
          clientProtectionId: `ord-tp-${order.orderId.slice(0, 12)}`,
          positionId: open.positionId,
          type: 'TAKE_PROFIT',
          triggerPrice: tp,
        });
      } catch {
        /* same */
      }
    }
  }

  private async persistLifecycleInTx(
    order: ForexOrderRecord,
    exec: ForexExecutionRecord,
    client?: ForexQueryable
  ): Promise<void> {
    await this.execution.persistLifecycle(exec, client);
    await this.persistNow(order, client);
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
      limitPrice: req.limitPrice ?? null,
      timeInForce: orderTimeInForce(req),
      expireAt: orderTimeInForce(req) === 'GTD' ? (req.expireAt?.trim() ?? null) : null,
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
    const loaded = await this.reloadByScope(accountId, req.clientOrderId);
    if (!loaded) return undefined;
    return this.store.claim(accountId, req);
  }

  private async reloadByScope(accountId: string, clientOrderId: string): Promise<ForexOrderRecord | undefined> {
    const { loadOrderByScope } = await import('./persist.js');
    const loaded = await loadOrderByScope(accountId, clientOrderId);
    if (!loaded) return undefined;
    this.store.put(loaded);
    return loaded;
  }

  private async resumeExisting(existing: ForexOrderRecord, req: ForexOrderRequest): Promise<ForexOrderRecord> {
    forexOrderIdempotencyHitTotal.inc({ result: 'replay' });
    this.emit(existing, 'ORDER_IDEMPOTENCY_HIT', { reason: 'DUPLICATE' });
    if (FOREX_ORDER_TERMINAL.has(existing.status)) return existing;
    if (existing.status === 'PENDING' || existing.status === 'TRIGGERING' || existing.status === 'ACCEPTED') {
      return existing;
    }
    const exec = this.execution.get(existing.clientExecId);
    if (exec && exec.fills.length > 0) {
      await this.commitExecutionLifecycle(existing, exec, Date.now());
    }
    void req;
    return existing;
  }

  private cloneOrder(order: ForexOrderRecord): ForexOrderRecord {
    return {
      ...order,
      fillIds: [...order.fillIds],
      events: order.events.map((e) => ({ ...e })),
      request: { ...order.request },
    };
  }

  private adoptOrder(live: ForexOrderRecord, next: ForexOrderRecord): void {
    live.filledVolume = next.filledVolume;
    live.remainingVolume = next.remainingVolume;
    live.status = next.status;
    live.failureReason = next.failureReason;
    live.executionId = next.executionId;
    live.fillIds = next.fillIds;
    live.events = next.events;
    live.request = next.request;
    live.updatedAt = next.updatedAt;
    live.lastQuoteKey = next.lastQuoteKey;
    live.lastModifyKey = next.lastModifyKey;
    live.version = next.version;
  }

  private transition(order: ForexOrderRecord, to: ForexOrderState): void {
    assertOrderTransition(order.status, to);
    order.status = to;
    order.updatedAt = new Date().toISOString();
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
    if (!this.holdLifecyclePersist) {
      this.journal(order, event);
      if (FOREX_LIFECYCLE_ORDER_EVENTS.has(eventType)) void this.persistEventNow(event);
    }
  }

  /**
   * Metadata is the order snapshot at journal time. Events raised on a working
   * clone are journalled after the clone is adopted, so they carry the
   * committed order state rather than the mid-execution projection.
   */
  private journal(order: ForexOrderRecord, event: ForexOrderEvent): void {
    const mapped = FOREX_ORDER_JOURNAL[event.eventType];
    if (!mapped) return;
    const reason = event.reason == null ? null : String(event.reason);
    const entry: ForexJournalInput = {
      accountId: order.accountId,
      severity: mapped.severity,
      category: 'order',
      eventType: event.eventType,
      orderId: order.orderId,
      referenceId: order.clientOrderId,
      message:
        `${order.side.toUpperCase()} ${order.orderType} ${order.symbol} ${order.requestedVolume} ${mapped.label}` +
        (reason && reason !== 'OK' ? ` · ${reason}` : ''),
      metadata: {
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        status: order.status,
        timeInForce: order.timeInForce,
        requestedVolume: order.requestedVolume,
        filledVolume: order.filledVolume,
        remainingVolume: order.remainingVolume,
        requestedPrice: order.requestedPrice,
        limitPrice: order.limitPrice,
        reason,
        version: order.version,
        executionId: order.executionId,
      },
    };
    recordForexJournalEvent(entry);
    void (async () => {
      try {
        const { evaluateForexAccountEventAlerts, forexOrderEventToAlertType } = await import('../customer/alert-engine.js');
        const alertType = forexOrderEventToAlertType(event.eventType);
        if (!alertType) return;
        await evaluateForexAccountEventAlerts({
          accountId: order.accountId,
          alertType,
          symbol: order.symbol,
          message: entry.message,
          metadata: { orderId: order.orderId, eventType: event.eventType, ...(entry.metadata as Record<string, unknown>) },
        });
      } catch {
        /* alerts are advisory; a missing table must not fail the order */
      }
    })();
  }

  private async finish(
    order: ForexOrderRecord,
    status: ForexOrderState,
    reason: ForexOrderReason | string,
    started: number,
    detail?: string
  ): Promise<ForexOrderRecord> {
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
    if (!this.holdLifecyclePersist) await this.persistNow(order);
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

  private async persistNow(order: ForexOrderRecord, client?: ForexQueryable): Promise<void> {
    if (!this.persistEnabled) return;
    const { persistOrder, persistOrderEvent } = await import('./persist.js');
    await persistOrder(order, client);
    for (const event of order.events) {
      if (FOREX_LIFECYCLE_ORDER_EVENTS.has(event.eventType)) await persistOrderEvent(event, client);
    }
  }

  private async persistPending(order: ForexOrderRecord): Promise<void> {
    if (!this.persistEnabled) return;
    const { persistPendingOrder } = await import('../advanced/persist.js');
    await persistPendingOrder({
      orderId: order.orderId,
      accountId: order.accountId,
      symbol: order.symbol,
      version: order.version,
      lastQuoteKey: order.lastQuoteKey,
      lastModifyKey: order.lastModifyKey,
    });
  }

  private async persistEventNow(event: ForexOrderEvent): Promise<void> {
    if (!this.persistEnabled) return;
    const { persistOrderEvent } = await import('./persist.js');
    await persistOrderEvent(event);
  }

  /**
   * Hold the account risk queue while running a composite op (Close By / Reverse).
   * Callers must use placeSerialized — never place() — to avoid *risk* deadlock.
   */
  runAccountSerialized<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    return this.store.enqueue(accountId, '*risk*', fn);
  }

  /** Place an order while the caller already holds runAccountSerialized / *risk*. */
  placeSerialized(accountId: string, raw: ForexOrderRequest): Promise<ForexOrderRecord> {
    if (!accountId) throw new ForexOrderError('UNAUTHENTICATED', 'Authentication required', 401);
    const req: ForexOrderRequest = { ...raw, clientOrderId: raw.clientOrderId?.trim() ?? '' };
    return this.store.enqueue(accountId, req.clientOrderId, () => this.placeLocked(accountId, req));
  }
}

let orderSingleton: ForexOrderService | null = null;

export function getForexOrderService(): ForexOrderService {
  if (!orderSingleton) {
    const pricing = getForexPricingService();
    const positions = getForexPositionService(pricing);
    getForexAccountingService(positions, pricing);
    orderSingleton = new ForexOrderService(
      getForexExecutionService(pricing),
      new ForexOrderStore(),
      true,
      positions,
      pricing
    );
    pricing.onAcceptedQuote((q) => {
      void orderSingleton?.evaluateQuote(q);
    });
  }
  return orderSingleton;
}

export function peekForexOrderService(): ForexOrderService | null {
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
