import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { appEventBus } from '@core/events/appEventBus';
import type { PlaceOrderRequest, SpotMarket, SpotOrder, OrderbookSnapshot, RecentTrade, Candle } from '@exchange/mobile-types';
import { TRADING_BAL_KEY, useTradingBalances } from '@features/wallet';

export const OPEN_ORDERS_KEY = ['openOrders'] as const;
export const BALANCES_KEY = TRADING_BAL_KEY;

export { useTradingBalances };

export function useOpenOrders() {
  const qc = useQueryClient();
  const q = useQuery<SpotOrder[]>({
    queryKey: OPEN_ORDERS_KEY,
    queryFn: () => getSpotRepository().getOpenOrders(),
    staleTime: 0,
    refetchInterval: 15_000,
  });
  useEffect(() => {
    return appEventBus.on('orders:invalidate', () => {
      void qc.invalidateQueries({ queryKey: OPEN_ORDERS_KEY });
    });
  }, [qc]);
  return q;
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlaceOrderRequest) => getSpotRepository().placeOrder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: OPEN_ORDERS_KEY });
      void qc.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => getSpotRepository().cancelOrder(orderId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: OPEN_ORDERS_KEY }),
  });
}

export function useCancelAllOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (market: string) => getSpotRepository().cancelAllOrders(market),
    onSuccess: () => void qc.invalidateQueries({ queryKey: OPEN_ORDERS_KEY }),
  });
}

export function useOrderbookBootstrap(symbol: string) {
  return useQuery<OrderbookSnapshot>({
    queryKey: ['orderbook', symbol],
    queryFn: () => getSpotRepository().getOrderbook(symbol),
    staleTime: 3_000,
    enabled: !!symbol,
  });
}

export function useRecentTradesBootstrap(symbol: string) {
  return useQuery<RecentTrade[]>({
    queryKey: ['recentTrades', symbol],
    queryFn: () => getSpotRepository().getRecentTrades(symbol),
    staleTime: 5_000,
    enabled: !!symbol,
  });
}

export function useCandles(symbol: string, interval: number) {
  return useQuery<Candle[]>({
    queryKey: ['candles', symbol, interval],
    queryFn: () => getSpotRepository().getCandles(symbol, interval),
    staleTime: 30_000,
    enabled: !!symbol,
  });
}

export function useMarketsMeta() {
  return useQuery<SpotMarket[]>({
    queryKey: ['marketsMeta'],
    queryFn: () => getSpotRepository().getMarkets(),
    staleTime: 60_000,
  });
}
