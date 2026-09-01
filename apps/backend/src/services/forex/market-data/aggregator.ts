import type { AggregatedBookTop, ForexQuoteDto, NormalizedQuote, ProviderHealthSnapshot } from '../types.js';
import { applyFreshness, quoteToDto } from './normalize.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { aggregateEligibleBook } from '../liquidity/book.js';
import { ForexRoutingRuleRegistry } from '../liquidity/routing-rules.js';

/**
 * Multi-LP book. Eligibility-aware best bid/ask — never first-provider-wins.
 */
export class ForexQuoteAggregator {
  private readonly byProviderSymbol = new Map<string, NormalizedQuote>();
  private readonly edaBySymbol = new Map<string, NormalizedQuote>();
  readonly rules: ForexRoutingRuleRegistry;
  private healthLookup: (providerId: string, now: Date) => ProviderHealthSnapshot | undefined = () => undefined;

  constructor(rules?: ForexRoutingRuleRegistry) {
    this.rules = rules ?? new ForexRoutingRuleRegistry();
  }

  setHealthLookup(fn: (providerId: string, now: Date) => ProviderHealthSnapshot | undefined): void {
    this.healthLookup = fn;
  }

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

  listProviderQuotes(symbol?: string): NormalizedQuote[] {
    const out: NormalizedQuote[] = [];
    for (const q of this.byProviderSymbol.values()) {
      if (symbol && q.symbol !== symbol) continue;
      out.push(q);
    }
    return out;
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

  getAggregatedBook(symbol: string, now = new Date()): AggregatedBookTop {
    return aggregateEligibleBook(symbol, this.listProviderQuotes(symbol), {
      rules: this.rules,
      healthOf: this.healthLookup,
      now,
    });
  }
}
