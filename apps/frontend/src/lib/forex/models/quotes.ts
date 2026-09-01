import type { ForexQuoteDto } from './types';

/** Accept only newer quote.sequence. Same or older sequence is a duplicate — drop. */
export function shouldAcceptQuote(prev: ForexQuoteDto | undefined, next: ForexQuoteDto): boolean {
  if (!next?.symbol) return false;
  if (!prev) return true;
  try {
    const a = BigInt(prev.sequence || '0');
    const b = BigInt(next.sequence || '0');
    return b > a;
  } catch {
    return next.receivedTimestamp > (prev.receivedTimestamp ?? '');
  }
}

export function isQuoteStale(q: ForexQuoteDto | undefined): boolean {
  if (!q) return true;
  return q.freshness === 'STALE' || q.quality === 'STALE' || q.status !== 'TRADEABLE';
}

export function executablePrice(side: 'buy' | 'sell', q: ForexQuoteDto | undefined): string | null {
  if (!q || isQuoteStale(q)) return null;
  return side === 'buy' ? q.ask : q.bid;
}

export function closePriceLabel(positionSide: 'long' | 'short'): 'BID' | 'ASK' {
  return positionSide === 'long' ? 'BID' : 'ASK';
}
