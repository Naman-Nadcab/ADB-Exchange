/**
 * Server-authoritative trailing stop ratchet.
 * LONG: SL may move up only (bid - distance).
 * SHORT: SL may move down only (ask + distance).
 * Never moves SL unfavorably. Never uses frontend prices.
 */
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexProtectionRecord } from './models.js';
import { executableTriggerPrice, quoteUsableForTrigger } from './trigger.js';

export function parseTrailingDistance(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const d = fxDecimal(String(raw).trim());
    if (!d.isFinite() || !d.gt(0)) return null;
    return d.toFixed();
  } catch {
    return null;
  }
}

export function initialTrailingStop(args: {
  positionSide: 'long' | 'short';
  quote: ForexQuoteDto;
  distance: string;
}): string | null {
  if (!quoteUsableForTrigger(args.quote)) return null;
  const dist = fxDecimal(args.distance);
  const mark = fxDecimal(executableTriggerPrice(args.positionSide, args.quote));
  const candidate = args.positionSide === 'long' ? mark.minus(dist) : mark.plus(dist);
  if (!candidate.gt(0)) return null;
  return alignToTick(args.quote.symbol, candidate.toFixed());
}

export function ratchetTrailingStop(args: {
  protection: Pick<ForexProtectionRecord, 'type' | 'positionSide' | 'triggerPrice' | 'trailingDistance'>;
  quote: ForexQuoteDto;
}): { moved: false } | { moved: true; triggerPrice: string } {
  if (args.protection.type !== 'STOP_LOSS') return { moved: false };
  const dist = parseTrailingDistance(args.protection.trailingDistance);
  if (!dist) return { moved: false };
  if (!quoteUsableForTrigger(args.quote)) return { moved: false };
  const current = fxDecimal(args.protection.triggerPrice);
  const mark = fxDecimal(executableTriggerPrice(args.protection.positionSide, args.quote));
  const d = fxDecimal(dist);
  const raw = args.protection.positionSide === 'long' ? mark.minus(d) : mark.plus(d);
  if (!raw.gt(0)) return { moved: false };
  const candidate = fxDecimal(alignToTick(args.quote.symbol, raw.toFixed()) ?? raw.toFixed());
  if (args.protection.positionSide === 'long') {
    if (candidate.lte(current)) return { moved: false };
  } else if (candidate.gte(current)) {
    return { moved: false };
  }
  return { moved: true, triggerPrice: candidate.toFixed() };
}

function alignToTick(symbol: string, price: string): string | null {
  const inst = getForexInstrumentBySymbol(symbol);
  if (!inst) return price;
  try {
    const tick = fxDecimal(inst.tickSize);
    const px = fxDecimal(price);
    if (!tick.gt(0)) return price;
    const steps = px.div(tick).toDecimalPlaces(0);
    return steps.times(tick).toFixed();
  } catch {
    return price;
  }
}
