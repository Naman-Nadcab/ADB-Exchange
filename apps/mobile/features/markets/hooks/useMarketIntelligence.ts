import { useQuery } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { CACHE_TTL_MS } from '@core/offline/cacheTTL';
import type { MarketIntelligencePayload } from '@exchange/mobile-types';

export const MARKET_INTELLIGENCE_KEY = ['markets', 'intelligence'] as const;

export function useMarketIntelligence() {
  return useQuery({
    queryKey: MARKET_INTELLIGENCE_KEY,
    queryFn: (): Promise<MarketIntelligencePayload> => getSpotRepository().getMarketIntelligence(),
    staleTime: CACHE_TTL_MS.markets,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function enrichWithIntelligence<T extends { symbol: string }>(
  items: T[],
  intelligence: MarketIntelligencePayload | undefined,
): (T & {
  change7dPct?: number | null;
  marketCap?: number | null;
  liquidityScore?: number | null;
  sparkline?: number[];
})[] {
  if (!intelligence?.symbols) return items;
  return items.map((item) => {
    const sym = item.symbol.toUpperCase().replace(/-/g, '_');
    const intel = intelligence.symbols[sym];
    if (!intel) return item;
    return {
      ...item,
      change7dPct: intel.change_7d_pct,
      marketCap: intel.market_cap,
      liquidityScore: intel.liquidity_score,
      sparkline: intel.sparkline?.length >= 2 ? intel.sparkline : undefined,
    };
  });
}
