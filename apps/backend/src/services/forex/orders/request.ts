import type { ForexExecSide } from '../execution/venue.js';

export type ForexCustomerOrderType = 'market' | 'limit' | 'stop';
export type ForexOrderIntent = 'CUSTOMER' | 'PROTECTION_CLOSE' | 'LIQUIDATION_CLOSE';

export interface ForexOrderRequest {
  clientOrderId: string;
  symbol: string;
  side: ForexExecSide;
  orderType: ForexCustomerOrderType;
  volume: string;
  requestedPrice?: string;
  maxSlippage?: string;
  maxDeviation?: string;
  /** Reducing closes from SL/TP or liquidation skip new-exposure gates. Default CUSTOMER. */
  intent?: ForexOrderIntent;
}

export function orderFingerprint(req: ForexOrderRequest): string {
  return [req.symbol, req.side, req.volume, req.orderType, req.requestedPrice ?? ''].join('|');
}

export function clientExecIdForOrder(orderId: string): string {
  return `FX-${orderId}`;
}
