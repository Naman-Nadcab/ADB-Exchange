import type { ForexExecSide } from '../execution/venue.js';

export type ForexCustomerOrderType = 'market' | 'limit' | 'stop';

export interface ForexOrderRequest {
  clientOrderId: string;
  symbol: string;
  side: ForexExecSide;
  orderType: ForexCustomerOrderType;
  volume: string;
  requestedPrice?: string;
  maxSlippage?: string;
  maxDeviation?: string;
}

export function orderFingerprint(req: ForexOrderRequest): string {
  return [req.symbol, req.side, req.volume, req.orderType, req.requestedPrice ?? ''].join('|');
}

export function clientExecIdForOrder(orderId: string): string {
  return `FX-${orderId}`;
}
