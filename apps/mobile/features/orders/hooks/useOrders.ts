import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import type { SpotOrder, RecentTrade } from '@exchange/mobile-types';

export function useOrderHistory(market?: string) {
  return useInfiniteQuery<SpotOrder[], Error, InfiniteData<SpotOrder[]>, readonly unknown[], number>({
    queryKey: ['orderHistory', market],
    queryFn: ({ pageParam }) =>
      getSpotRepository().getOrderHistory({ page: pageParam, limit: 20, market }),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, pageParam) => (last.length < 20 ? undefined : pageParam + 1),
  });
}

export function useTradeHistory(market?: string) {
  return useInfiniteQuery<RecentTrade[], Error, InfiniteData<RecentTrade[]>, readonly unknown[], number>({
    queryKey: ['tradeHistory', market],
    queryFn: ({ pageParam }) =>
      getSpotRepository().getTradeHistory({ page: pageParam, limit: 20, market }),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, pageParam) => (last.length < 20 ? undefined : pageParam + 1),
  });
}
