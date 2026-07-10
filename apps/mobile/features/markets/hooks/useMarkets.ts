import { useQuery } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { mergeTickers } from '@core/domain/markets/marketUtils';
import { readCache } from '@core/offline/readCache';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { CACHE_TTL_MS } from '@core/offline/cacheTTL';
import type { MarketListItem } from '@exchange/mobile-types';

export const MARKETS_QUERY_KEY = ['markets'] as const;

export function useMarkets() {
  return useQuery({
    queryKey: MARKETS_QUERY_KEY,
    queryFn: async (): Promise<MarketListItem[]> => {
      const tickers = await getSpotRepository().getTickers();
      const items = mergeTickers(tickers);
      readCache.set(CACHE_KEYS.markets, items);
      return items;
    },
    staleTime: CACHE_TTL_MS.markets,
    gcTime: 5 * 60_000,
    initialData: () => readCache.get<MarketListItem[]>(CACHE_KEYS.markets) ?? undefined,
    refetchOnWindowFocus: true,
  });
}

export function tickerQueryKey(symbol: string) {
  return ['ticker', symbol] as const;
}

export function useTicker(symbol: string) {
  return useQuery({
    queryKey: tickerQueryKey(symbol),
    queryFn: () => getSpotRepository().getTicker(symbol),
    staleTime: CACHE_TTL_MS.ticker,
    gcTime: 60_000,
    enabled: !!symbol,
  });
}
