import type { ForexOrderRequest } from './request.js';
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
  maxSlippage: string | null;
  maxDeviation: string | null;
  status: ForexOrderState;
  failureReason: ForexOrderReason | string | null;
  executionId: string | null;
  fillIds: string[];
  source: 'SIMULATED';
  executionMode: 'MOCK';
  events: ForexOrderEvent[];
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
    status: order.status,
    failureReason: order.failureReason,
    executionId: order.executionId,
    source: order.source,
    executionMode: order.executionMode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
