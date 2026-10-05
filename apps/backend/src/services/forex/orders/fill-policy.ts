/**
 * RETURN keeps an unfilled remainder working.
 * BOC (book or cancel) rejects anything that would take the executable quote.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexQuoteDto } from '../types.js';

export function bocLimitWouldTake(side: 'buy' | 'sell', limitPrice: string, quote: ForexQuoteDto): boolean {
  const limit = fxDecimal(limitPrice);
  if (!limit.isFinite() || !limit.gt(0)) return true;
  if (side === 'buy') return limit.gte(quote.ask);
  return limit.lte(quote.bid);
}
