/**
 * Deterministic pending-order trigger evaluator.
 *
 * BUY LIMIT:  market ask <= requested price
 * SELL LIMIT: market bid >= requested price
 * BUY STOP:   market ask >= requested price
 * SELL STOP:  market bid <= requested price
 * BUY STOP LIMIT:  triggers like BUY STOP on the stop price, then works as BUY LIMIT
 * SELL STOP LIMIT: triggers like SELL STOP on the stop price, then works as SELL LIMIT
 *
 * Authoritative backend quotes only. Never frontend prices or nondeterministic generators.
 * Never rewrites requestedPrice. Stale / crossed / untradeable fail closed.
 */
import { fxDecimal } from '../decimal-fx.js';
import { quoteKey, quoteUsableForTrigger } from '../protection/trigger.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexOrderRecord } from './models.js';
import type { ForexCustomerOrderType } from './request.js';

export { quoteKey, quoteUsableForTrigger };

export type ForexPendingKind = 'limit' | 'stop' | 'stop_limit';

export const FOREX_PENDING_ORDER_TYPES = ['limit', 'stop', 'stop_limit'] as const;

export function isForexPendingOrderType(orderType: string): orderType is ForexPendingKind {
  return (FOREX_PENDING_ORDER_TYPES as readonly string[]).includes(orderType);
}

export function pendingQuoteSide(orderType: ForexPendingKind, side: 'buy' | 'sell'): 'BID' | 'ASK' {
  if (side === 'buy') return 'ASK';
  return 'BID';
}

export function pendingMarketPrice(orderType: ForexPendingKind, side: 'buy' | 'sell', quote: ForexQuoteDto): string {
  return pendingQuoteSide(orderType, side) === 'ASK' ? quote.ask : quote.bid;
}

export function isPendingTriggered(order: Pick<ForexOrderRecord, 'orderType' | 'side' | 'requestedPrice'>, quote: ForexQuoteDto): boolean {
  if (!isForexPendingOrderType(order.orderType)) return false;
  if (order.requestedPrice == null || order.requestedPrice === '') return false;
  const requested = fxDecimal(order.requestedPrice);
  const ask = fxDecimal(quote.ask);
  const bid = fxDecimal(quote.bid);
  if (order.orderType === 'limit' && order.side === 'buy') return ask.lte(requested);
  if (order.orderType === 'limit' && order.side === 'sell') return bid.gte(requested);
  if (order.orderType === 'stop' && order.side === 'buy') return ask.gte(requested);
  if (order.orderType === 'stop' && order.side === 'sell') return bid.lte(requested);
  if (order.orderType === 'stop_limit' && order.side === 'buy') return ask.gte(requested);
  if (order.orderType === 'stop_limit' && order.side === 'sell') return bid.lte(requested);
  return false;
}

/**
 * True when a triggered stop_limit can fill straight away at its limit price.
 * BUY: ask <= limit. SELL: bid >= limit.
 */
export function isStopLimitMarketable(
  side: 'buy' | 'sell',
  limitPrice: string | null | undefined,
  quote: ForexQuoteDto
): boolean {
  if (limitPrice == null || limitPrice === '') return false;
  const limit = fxDecimal(limitPrice);
  if (!limit.isFinite() || !limit.gt(0)) return false;
  return side === 'buy' ? fxDecimal(quote.ask).lte(limit) : fxDecimal(quote.bid).gte(limit);
}

export function pendingTriggerValid(args: {
  orderType: ForexCustomerOrderType;
  side: 'buy' | 'sell';
  requestedPrice?: string | null;
  limitPrice?: string | null;
}): { ok: true } | { ok: false; reason: 'INVALID_PRICE' | 'UNSUPPORTED_ORDER_TYPE' | 'INVALID_TRIGGER_RELATIONSHIP' | 'INVALID_LIMIT_PRICE' } {
  if (args.orderType === 'market') return { ok: true };
  if (!isForexPendingOrderType(args.orderType)) {
    return { ok: false, reason: 'UNSUPPORTED_ORDER_TYPE' };
  }
  if (args.requestedPrice == null || args.requestedPrice === '') {
    return { ok: false, reason: 'INVALID_PRICE' };
  }
  let stop;
  try {
    stop = fxDecimal(args.requestedPrice);
    if (!stop.isFinite() || !stop.gt(0)) return { ok: false, reason: 'INVALID_PRICE' };
  } catch {
    return { ok: false, reason: 'INVALID_PRICE' };
  }
  if (args.side !== 'buy' && args.side !== 'sell') {
    return { ok: false, reason: 'INVALID_TRIGGER_RELATIONSHIP' };
  }
  if (args.orderType === 'stop_limit') {
    if (args.limitPrice == null || args.limitPrice === '') {
      return { ok: false, reason: 'INVALID_LIMIT_PRICE' };
    }
    let limit;
    try {
      limit = fxDecimal(args.limitPrice);
      if (!limit.isFinite() || !limit.gt(0)) return { ok: false, reason: 'INVALID_LIMIT_PRICE' };
    } catch {
      return { ok: false, reason: 'INVALID_LIMIT_PRICE' };
    }
    // BUY stop-limit works below its stop; SELL stop-limit works above its stop.
    if (args.side === 'buy' && limit.gt(stop)) {
      return { ok: false, reason: 'INVALID_TRIGGER_RELATIONSHIP' };
    }
    if (args.side === 'sell' && limit.lt(stop)) {
      return { ok: false, reason: 'INVALID_TRIGGER_RELATIONSHIP' };
    }
  }
  return { ok: true };
}

export function isPendingWorkingStatus(status: string): boolean {
  return status === 'ACCEPTED' || status === 'PENDING';
}
