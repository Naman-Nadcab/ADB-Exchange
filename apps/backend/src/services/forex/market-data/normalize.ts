import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import type { ForexInstrument, NormalizedQuote, ProviderRawQuote } from '../types.js';
import { calculateMid, calculateSpread } from './spread.js';
import { evaluateStaleness, resolveQuoteQuality } from './staleness.js';

export interface NormalizeArgs {
  raw: ProviderRawQuote;
  instrument: ForexInstrument;
  receivedTimestamp: Date;
  edaReceiveSequence: bigint;
  now?: Date;
}

/**
 * Adapter output → EDA quote. Provider-specific `raw` is dropped here.
 */
export function normalizeProviderQuote(args: NormalizeArgs): NormalizedQuote {
  const { raw, instrument, receivedTimestamp, edaReceiveSequence } = args;
  const now = args.now ?? receivedTimestamp;
  const bid = fxDecimal(raw.bid);
  const ask = fxDecimal(raw.ask);
  const mid = calculateMid(bid, ask);
  const spread = calculateSpread(bid, ask, instrument);
  const stale = evaluateStaleness({
    providerTimestamp: raw.providerTimestamp,
    receivedTimestamp,
    now,
  });
  const halted = instrument.tradingStatus !== 'active';
  const quality = resolveQuoteQuality({
    source: raw.source,
    freshness: stale.freshness,
    halted,
    crossed: ask.lt(bid),
  });
  return {
    symbol: instrument.symbol,
    instrumentId: instrument.id,
    bid,
    ask,
    mid,
    spread: spread.spread,
    spreadPips: spread.spreadPips,
    spreadTicks: spread.spreadTicks,
    providerId: raw.providerId,
    providerCode: raw.providerCode,
    providerTimestamp: raw.providerTimestamp,
    receivedTimestamp,
    providerSequence: raw.providerSequence,
    edaReceiveSequence,
    quality,
    status: halted ? 'HALTED' : quality === 'STALE' ? 'UNAVAILABLE' : 'TRADEABLE',
    source: raw.source,
    freshness: stale.freshness,
  };
}

export function applyFreshness(quote: NormalizedQuote, now: Date): NormalizedQuote {
  const stale = evaluateStaleness({
    providerTimestamp: quote.providerTimestamp,
    receivedTimestamp: quote.receivedTimestamp,
    now,
  });
  const halted = quote.status === 'HALTED' || quote.quality === 'HALTED';
  const quality = resolveQuoteQuality({
    source: quote.source,
    freshness: stale.freshness,
    halted,
    crossed: quote.quality === 'CROSSED',
  });
  return {
    ...quote,
    freshness: stale.freshness,
    quality,
    status: halted ? 'HALTED' : stale.freshness === 'STALE' ? 'UNAVAILABLE' : quote.status === 'REJECTED' ? 'REJECTED' : 'TRADEABLE',
  };
}

export function quoteToDto(quote: NormalizedQuote, displaySymbol: string, digits: number) {
  const fresh = applyFreshness(quote, new Date());
  return {
    symbol: fresh.symbol,
    displaySymbol,
    instrumentId: fresh.instrumentId,
    bid: fxToPriceString(fresh.bid, digits),
    ask: fxToPriceString(fresh.ask, digits),
    mid: fxToPriceString(fresh.mid, digits),
    spread: fresh.spread.toFixed(digits),
    spreadPips: fresh.spreadPips.toFixed(),
    spreadTicks: fresh.spreadTicks.toFixed(),
    providerId: fresh.providerId,
    providerCode: fresh.providerCode,
    providerTimestamp: fresh.providerTimestamp.toISOString(),
    receivedTimestamp: fresh.receivedTimestamp.toISOString(),
    sequence: fresh.providerSequence.toString(),
    edaReceiveSequence: fresh.edaReceiveSequence.toString(),
    quality: fresh.quality,
    status: fresh.status,
    source: fresh.source,
    freshness: fresh.freshness,
  };
}
