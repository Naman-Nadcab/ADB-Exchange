import type { ForexOrderRequest, ForexTimeInForce } from './request.js';
import type { ForexOrderEventType, ForexOrderReason, ForexOrderState } from './states.js';

export interface ForexOrderEvent {
  eventId: string;
  orderId: string;
  clientOrderId: string;
  timestamp: string;
  eventType: ForexOrderEventType;
  reason?: ForexOrderReason | string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ForexOrderRecord {
  orderId: string;
  clientOrderId: string;
  clientExecId: string;
  accountId: string;
  fingerprint: string;
  request: ForexOrderRequest;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: ForexOrderRequest['orderType'];
  requestedVolume: string;
  filledVolume: string;
  remainingVolume: string;
  requestedPrice: string | null;
  /** stop_limit LIMIT price. Retained after the stop triggers. */
  limitPrice: string | null;
  timeInForce: ForexTimeInForce;
  /** GTD expiry instant (UTC ISO). Null for other TIFs. */
  expireAt: string | null;
  maxSlippage: string | null;
  maxDeviation: string | null;
  status: ForexOrderState;
  failureReason: ForexOrderReason | string | null;
  executionId: string | null;
  fillIds: string[];
  source: 'SIMULATED' | 'LIVE';
  executionMode: 'MOCK' | 'BROKER';
  events: ForexOrderEvent[];
  version: number;
  lastQuoteKey: string | null;
  lastModifyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ForexOrderError extends Error {
  constructor(
    readonly reason: ForexOrderReason,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexOrderError';
  }
}

export function publicForexOrder(order: ForexOrderRecord) {
  return {
    orderId: order.orderId,
    clientOrderId: order.clientOrderId,
    clientExecId: order.clientExecId,
    symbol: order.symbol,
    side: order.side,
    type: order.orderType,
    requestedVolume: order.requestedVolume,
    filledVolume: order.filledVolume,
    remainingVolume: order.remainingVolume,
    requestedPrice: order.requestedPrice,
    limitPrice: order.limitPrice,
    timeInForce: order.timeInForce,
    expireAt: order.expireAt,
    stopLoss: order.request.stopLoss ?? null,
    takeProfit: order.request.takeProfit ?? null,
    comment: order.request.comment ?? null,
    status: order.status,
    failureReason: order.failureReason,
    executionId: order.executionId,
    version: order.version,
    source: order.source,
    executionMode: order.executionMode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export interface ForexOrderModifyRequest {
  requestedPrice?: string;
  /** stop_limit only — patch the working LIMIT price. */
  limitPrice?: string;
  volume?: string;
  stopLoss?: string;
  takeProfit?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}
