import { useInfiniteQuery } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';

export function useSpotOrderHistory(market?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['orderHistory', market],
    queryFn: ({ pageParam = 1 }) =>
      getSpotRepository().getOrderHistory({ page: pageParam, limit: 20, market }),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, pageParam) => (last.length < 20 ? undefined : pageParam + 1),
    enabled,
  });
}

export function useSpotTradeHistory(market?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['tradeHistory', market],
    queryFn: ({ pageParam = 1 }) =>
      getSpotRepository().getTradeHistory({ page: pageParam, limit: 20, market }),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, pageParam) => (last.length < 20 ? undefined : pageParam + 1),
    enabled,
  });
}
