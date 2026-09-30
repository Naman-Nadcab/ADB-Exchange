import type { ForexExecSide } from '../execution/venue.js';

export type ForexCustomerOrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type ForexOrderIntent = 'CUSTOMER' | 'CUSTOMER_CLOSE' | 'PROTECTION_CLOSE' | 'LIQUIDATION_CLOSE';

export const FOREX_TIME_IN_FORCE = ['GTC', 'IOC', 'FOK', 'DAY', 'GTD'] as const;
export type ForexTimeInForce = (typeof FOREX_TIME_IN_FORCE)[number];
export const FOREX_DEFAULT_TIME_IN_FORCE: ForexTimeInForce = 'GTC';

export interface ForexOrderRequest {
  clientOrderId: string;
  symbol: string;
  side: ForexExecSide;
  orderType: ForexCustomerOrderType;
  volume: string;
  /** Pending trigger price. For stop_limit this is the STOP price. */
  requestedPrice?: string;
  /** stop_limit only: the LIMIT price the order works at once the stop triggers. */
  limitPrice?: string;
  /** Defaults to GTC. IOC/FOK are market-only. GTD requires expireAt (UTC ISO). */
  timeInForce?: ForexTimeInForce;
  /** Required when timeInForce is GTD — UTC ISO-8601 instant. */
  expireAt?: string;
  maxSlippage?: string;
  maxDeviation?: string;
  stopLoss?: string;
  takeProfit?: string;
  comment?: string;
  /** Reducing closes from SL/TP or liquidation skip new-exposure gates. Default CUSTOMER. */
  intent?: ForexOrderIntent;
  /**
   * Target open position for reduce-only intents (HEDGING mandatory;
   * NETTING optional — falls back to the single open symbol position).
   */
  reducePositionId?: string;
}

export function normalizeForexTimeInForce(value: unknown): ForexTimeInForce | null {
  if (value == null || value === '') return FOREX_DEFAULT_TIME_IN_FORCE;
  const upper = String(value).trim().toUpperCase();
  return (FOREX_TIME_IN_FORCE as readonly string[]).includes(upper) ? (upper as ForexTimeInForce) : null;
}

export function orderTimeInForce(req: Pick<ForexOrderRequest, 'timeInForce'>): ForexTimeInForce {
  return req.timeInForce ?? FOREX_DEFAULT_TIME_IN_FORCE;
}

/**
 * Idempotency fingerprint. The legacy shape is preserved verbatim for
 * market/limit/stop with the default TIF so already-persisted fingerprints
 * keep replaying instead of raising IDEMPOTENCY_CONFLICT.
 */
export function orderFingerprint(req: ForexOrderRequest): string {
  const base = [req.symbol, req.side, req.volume, req.orderType, req.requestedPrice ?? ''].join('|');
  const tif = orderTimeInForce(req);
  if (req.orderType !== 'stop_limit' && tif === FOREX_DEFAULT_TIME_IN_FORCE && !req.expireAt) return base;
  return [base, req.limitPrice ?? '', tif, req.expireAt ?? ''].join('|');
}

export function clientExecIdForOrder(orderId: string): string {
  return `FX-${orderId}`;
}
