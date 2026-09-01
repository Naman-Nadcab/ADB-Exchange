import { fxDecimal } from '../decimal-fx.js';
import type { AggregatedBookTop, ForexQuoteDto, NormalizedQuote } from '../types.js';
import { applyFreshness, quoteToDto } from './normalize.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';

/**
 * Multi-LP book. Phase 1 typically has MOCK-A publishing; MOCK-B/C stay registered
 * so Phase 2 can add adapters without changing this contract.
 */
export class ForexQuoteAggregator {
  private readonly byProviderSymbol = new Map<string, NormalizedQuote>();
  private readonly edaBySymbol = new Map<string, NormalizedQuote>();

  private key(providerId: string, symbol: string): string {
    return `${providerId}:${symbol}`;
  }

  ingest(quote: NormalizedQuote): void {
    this.byProviderSymbol.set(this.key(quote.providerId, quote.symbol), quote);
    const current = this.edaBySymbol.get(quote.symbol);
    if (!current || quote.edaReceiveSequence > current.edaReceiveSequence) {
      this.edaBySymbol.set(quote.symbol, quote);
    }
  }

  getLatest(symbol: string, now = new Date()): NormalizedQuote | undefined {
    const q = this.edaBySymbol.get(symbol);
    return q ? applyFreshness(q, now) : undefined;
  }

  getLatestDto(symbol: string, now = new Date()): ForexQuoteDto | undefined {
    const instrument = getForexInstrumentBySymbol(symbol);
    const q = this.getLatest(symbol, now);
    if (!instrument || !q) return undefined;
    return quoteToDto(q, instrument.displaySymbol, instrument.pricePrecision);
  }

  listLatest(now = new Date()): ForexQuoteDto[] {
    const out: ForexQuoteDto[] = [];
    for (const symbol of this.edaBySymbol.keys()) {
      const dto = this.getLatestDto(symbol, now);
      if (dto) out.push(dto);
    }
    return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  /**
   * Best bid/ask across fresh, tradeable provider quotes.
   * Stale quotes are never eligible for future routing.
   */
  getAggregatedBook(symbol: string, now = new Date()): AggregatedBookTop {
    const instrument = getForexInstrumentBySymbol(symbol);
    const quotes: ForexQuoteDto[] = [];
    let bestBid: { price: ReturnType<typeof fxDecimal>; providerId: string } | null = null;
    let bestAsk: { price: ReturnType<typeof fxDecimal>; providerId: string } | null = null;
    const eligible: string[] = [];

    for (const raw of this.byProviderSymbol.values()) {
      if (raw.symbol !== symbol) continue;
      const q = applyFreshness(raw, now);
      if (!instrument) continue;
      const dto = quoteToDto(q, instrument.displaySymbol, instrument.pricePrecision);
      quotes.push(dto);
      if (q.freshness !== 'FRESH' || q.status !== 'TRADEABLE') continue;
      eligible.push(q.providerId);
      if (!bestBid || q.bid.gt(bestBid.price)) bestBid = { price: q.bid, providerId: q.providerId };
      if (!bestAsk || q.ask.lt(bestAsk.price)) bestAsk = { price: q.ask, providerId: q.providerId };
    }

    const spread =
      bestBid && bestAsk ? bestAsk.price.minus(bestBid.price).toFixed(instrument?.pricePrecision ?? 5) : null;

    return {
      symbol,
      bestBid: bestBid && instrument ? bestBid.price.toFixed(instrument.pricePrecision) : null,
      bestAsk: bestAsk && instrument ? bestAsk.price.toFixed(instrument.pricePrecision) : null,
      bestBidProviderId: bestBid?.providerId ?? null,
      bestAskProviderId: bestAsk?.providerId ?? null,
      spread,
      eligibleProviderIds: [...new Set(eligible)],
      quotes,
    };
  }
}
