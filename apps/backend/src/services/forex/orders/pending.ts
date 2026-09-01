/**
 * Deterministic pending-order trigger evaluator.
 *
 * BUY LIMIT:  market ask <= requested price
 * SELL LIMIT: market bid >= requested price
 * BUY STOP:   market ask >= requested price
 * SELL STOP:  market bid <= requested price
 *
 * Authoritative backend quotes only. Never frontend prices or nondeterministic generators.
 * Never rewrites requestedPrice. Stale / crossed / untradeable fail closed.
 */
import { fxDecimal } from '../decimal-fx.js';
import { quoteKey, quoteUsableForTrigger } from '../protection/trigger.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexOrderRecord } from './models.js';

export { quoteKey, quoteUsableForTrigger };

export type ForexPendingKind = 'limit' | 'stop';

export function pendingQuoteSide(orderType: ForexPendingKind, side: 'buy' | 'sell'): 'BID' | 'ASK' {
  if (side === 'buy') return 'ASK';
  return 'BID';
}

export function pendingMarketPrice(orderType: ForexPendingKind, side: 'buy' | 'sell', quote: ForexQuoteDto): string {
  return pendingQuoteSide(orderType, side) === 'ASK' ? quote.ask : quote.bid;
}

export function isPendingTriggered(order: Pick<ForexOrderRecord, 'orderType' | 'side' | 'requestedPrice'>, quote: ForexQuoteDto): boolean {
  if (order.orderType !== 'limit' && order.orderType !== 'stop') return false;
  if (order.requestedPrice == null || order.requestedPrice === '') return false;
  const requested = fxDecimal(order.requestedPrice);
  const ask = fxDecimal(quote.ask);
  const bid = fxDecimal(quote.bid);
  if (order.orderType === 'limit' && order.side === 'buy') return ask.lte(requested);
  if (order.orderType === 'limit' && order.side === 'sell') return bid.gte(requested);
  if (order.orderType === 'stop' && order.side === 'buy') return ask.gte(requested);
  if (order.orderType === 'stop' && order.side === 'sell') return bid.lte(requested);
  return false;
}

export function pendingTriggerValid(args: {
  orderType: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  requestedPrice?: string | null;
}): { ok: true } | { ok: false; reason: 'INVALID_PRICE' | 'UNSUPPORTED_ORDER_TYPE' | 'INVALID_TRIGGER_RELATIONSHIP' } {
  if (args.orderType === 'market') return { ok: true };
  if (args.orderType !== 'limit' && args.orderType !== 'stop') {
    return { ok: false, reason: 'UNSUPPORTED_ORDER_TYPE' };
  }
  if (args.requestedPrice == null || args.requestedPrice === '') {
    return { ok: false, reason: 'INVALID_PRICE' };
  }
  try {
    const px = fxDecimal(args.requestedPrice);
    if (!px.isFinite() || !px.gt(0)) return { ok: false, reason: 'INVALID_PRICE' };
  } catch {
    return { ok: false, reason: 'INVALID_PRICE' };
  }
  if (args.side !== 'buy' && args.side !== 'sell') {
    return { ok: false, reason: 'INVALID_TRIGGER_RELATIONSHIP' };
  }
  return { ok: true };
}

export function isPendingWorkingStatus(status: string): boolean {
  return status === 'ACCEPTED' || status === 'PENDING';
}
