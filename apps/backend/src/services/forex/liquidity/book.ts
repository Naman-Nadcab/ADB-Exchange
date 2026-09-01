import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { applyFreshness, quoteToDto } from '../market-data/normalize.js';
import type {
  AggregatedBookTop,
  ForexEligibilityResult,
  ForexQuoteDto,
  NormalizedQuote,
  ProviderHealthSnapshot,
} from '../types.js';
import { evaluateProviderEligibility } from './eligibility.js';
import { ForexRoutingRuleRegistry } from './routing-rules.js';
import { deriveBookStatus } from './snapshot.js';

export interface BookBuildContext {
  rules: ForexRoutingRuleRegistry;
  healthOf: (providerId: string, now: Date) => ProviderHealthSnapshot | undefined;
  now: Date;
}

export function aggregateEligibleBook(
  symbol: string,
  quotes: NormalizedQuote[],
  ctx: BookBuildContext
): AggregatedBookTop {
  const instrument = getForexInstrumentBySymbol(symbol);
  const rules = ctx.rules.listForSymbol(symbol);
  const byProvider = new Map<string, NormalizedQuote>();
  for (const q of quotes) {
    if (q.symbol === symbol) byProvider.set(q.providerId, applyFreshness(q, ctx.now));
  }

  const dtos: ForexQuoteDto[] = [];
  const eligibility: ForexEligibilityResult[] = [];
  let bestBid: { price: ReturnType<typeof fxDecimal>; providerId: string; code: string } | null = null;
  let bestAsk: { price: ReturnType<typeof fxDecimal>; providerId: string; code: string } | null = null;
  const eligibleIds: string[] = [];
  let healthy = 0;
  let staleCount = 0;

  for (const rule of rules) {
    const q = byProvider.get(rule.providerId);
    const health = ctx.healthOf(rule.providerId, ctx.now);
    if (health && (health.status === 'HEALTHY' || health.status === 'DEGRADED')) healthy += 1;
    const el = evaluateProviderEligibility({
      quote: q,
      health,
      rule,
      instrumentSupported: Boolean(instrument),
      now: ctx.now,
    });
    eligibility.push(el);
    if (q && instrument) dtos.push(quoteToDto(q, instrument.displaySymbol, instrument.pricePrecision));
    if (q && q.freshness === 'STALE') staleCount += 1;
    if (!el.eligible || !q) continue;
    eligibleIds.push(q.providerId);
    if (!bestBid || q.bid.gt(bestBid.price)) bestBid = { price: q.bid, providerId: q.providerId, code: q.providerCode };
    if (!bestAsk || q.ask.lt(bestAsk.price)) bestAsk = { price: q.ask, providerId: q.providerId, code: q.providerCode };
  }

  const digits = instrument?.pricePrecision ?? 5;
  const status = deriveBookStatus({
    halted: instrument?.tradingStatus === 'halted',
    providerCount: rules.length,
    eligibleCount: eligibleIds.length,
    allStale: staleCount > 0 && staleCount === byProvider.size && eligibleIds.length === 0,
    someIneligible: eligibility.some((e) => !e.eligible),
  });

  return {
    symbol,
    bestBid: bestBid && instrument ? bestBid.price.toFixed(digits) : null,
    bestAsk: bestAsk && instrument ? bestAsk.price.toFixed(digits) : null,
    bestBidProviderId: bestBid?.providerId ?? null,
    bestAskProviderId: bestAsk?.providerId ?? null,
    bestBidProviderCode: bestBid?.code ?? null,
    bestAskProviderCode: bestAsk?.code ?? null,
    spread: bestBid && bestAsk ? bestAsk.price.minus(bestBid.price).toFixed(digits) : null,
    providerCount: rules.length,
    healthyProviderCount: healthy,
    eligibleProviderCount: eligibleIds.length,
    eligibleProviderIds: [...new Set(eligibleIds)],
    status,
    quotes: dtos.sort((a, b) => a.providerCode.localeCompare(b.providerCode)),
    eligibility,
  };
}
