/**
 * Protection trigger evaluator.
 *
 * LONG close (sell) uses BID.
 * SHORT close (buy) uses ASK.
 *
 * LONG  SL: bid <= trigger
 * LONG  TP: bid >= trigger
 * SHORT SL: ask >= trigger
 * SHORT TP: ask <= trigger
 *
 * Never uses frontend prices or Math.random().
 * Stale / crossed / untradeable / missing quotes fail closed (do not trigger).
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexProtectionRecord } from './models.js';

export function quoteKey(quote: ForexQuoteDto): string {
  return `${quote.symbol}:${quote.edaReceiveSequence}:${quote.bid}:${quote.ask}`;
}

export function triggerPriceSide(positionSide: 'long' | 'short'): 'BID' | 'ASK' {
  return positionSide === 'long' ? 'BID' : 'ASK';
}

export function executableTriggerPrice(positionSide: 'long' | 'short', quote: ForexQuoteDto): string {
  return positionSide === 'long' ? quote.bid : quote.ask;
}

export function quoteUsableForTrigger(quote: ForexQuoteDto | undefined): quote is ForexQuoteDto {
  if (!quote) return false;
  if (quote.freshness === 'STALE' || quote.quality === 'STALE') return false;
  if (quote.status !== 'TRADEABLE') return false;
  if (quote.quality === 'CROSSED') return false;
  const bid = fxDecimal(quote.bid);
  const ask = fxDecimal(quote.ask);
  if (!bid.gt(0) || !ask.gt(0) || ask.lt(bid)) return false;
  return true;
}

export function isProtectionTriggered(protection: ForexProtectionRecord, marketPrice: string): boolean {
  const px = fxDecimal(marketPrice);
  const trig = fxDecimal(protection.triggerPrice);
  if (protection.positionSide === 'long') {
    return protection.type === 'STOP_LOSS' ? px.lte(trig) : px.gte(trig);
  }
  return protection.type === 'STOP_LOSS' ? px.gte(trig) : px.lte(trig);
}

/** True when trigger sits on the correct side of the live market (not already breached, not inverted). */
export function triggerDirectionValid(args: {
  type: ForexProtectionRecord['type'];
  positionSide: 'long' | 'short';
  triggerPrice: string;
  marketPrice: string;
}): { ok: true } | { ok: false; reason: 'INVALID_TRIGGER_DIRECTION' | 'TRIGGER_ALREADY_MET' } {
  const trig = fxDecimal(args.triggerPrice);
  const mkt = fxDecimal(args.marketPrice);
  if (args.positionSide === 'long') {
    if (args.type === 'STOP_LOSS') {
      if (trig.gt(mkt)) return { ok: false, reason: 'INVALID_TRIGGER_DIRECTION' };
      if (trig.eq(mkt) || mkt.lte(trig)) return { ok: false, reason: 'TRIGGER_ALREADY_MET' };
    } else {
      if (trig.lt(mkt)) return { ok: false, reason: 'INVALID_TRIGGER_DIRECTION' };
      if (trig.eq(mkt) || mkt.gte(trig)) return { ok: false, reason: 'TRIGGER_ALREADY_MET' };
    }
  } else if (args.type === 'STOP_LOSS') {
    if (trig.lt(mkt)) return { ok: false, reason: 'INVALID_TRIGGER_DIRECTION' };
    if (trig.eq(mkt) || mkt.gte(trig)) return { ok: false, reason: 'TRIGGER_ALREADY_MET' };
  } else {
    if (trig.gt(mkt)) return { ok: false, reason: 'INVALID_TRIGGER_DIRECTION' };
    if (trig.eq(mkt) || mkt.lte(trig)) return { ok: false, reason: 'TRIGGER_ALREADY_MET' };
  }
  return { ok: true };
}
