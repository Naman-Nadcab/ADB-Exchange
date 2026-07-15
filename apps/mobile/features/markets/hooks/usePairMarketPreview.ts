import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWs } from '@app/providers/WsProvider';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';
import { useMarketDataStore } from '@core/state/marketDataStore';

/** Public market data preview for Pair Detail — WS + REST, guest-safe. */
export function usePairMarketPreview(symbol: string) {
  const { subscriptions } = useWs();
  const normalized = normalizeSymbol(symbol);

  useEffect(() => {
    const unsubs = [
      subscriptions.subscribeTicker(normalized),
      subscriptions.subscribeOrderbook(normalized),
      subscriptions.subscribeTrades(normalized),
    ];
    return () => unsubs.forEach((u) => u());
  }, [normalized, subscriptions]);

  const orderbookQ = useQuery({
    queryKey: ['orderbook', normalized],
    queryFn: () => getSpotRepository().getOrderbook(normalized),
    staleTime: 3_000,
    enabled: !!normalized,
  });

  const tradesQ = useQuery({
    queryKey: ['recentTrades', normalized],
    queryFn: () => getSpotRepository().getRecentTrades(normalized),
    staleTime: 5_000,
    enabled: !!normalized,
  });

  useEffect(() => {
    if (orderbookQ.data) {
      useMarketDataStore.getState().setOrderbook(normalized, { ...orderbookQ.data, symbol: normalized });
    }
  }, [orderbookQ.data, normalized]);

  useEffect(() => {
    if (tradesQ.data?.length) {
      useMarketDataStore.getState().appendTrades(normalized, tradesQ.data);
    }
  }, [tradesQ.data, normalized]);

  const orderbook = useMarketDataStore((s) => s.orderbooks[normalized]);
  const trades = useMarketDataStore((s) => s.trades[normalized] ?? []);

  return {
    orderbook,
    trades,
    isLoading: orderbookQ.isLoading || tradesQ.isLoading,
    refetch: () => {
      void orderbookQ.refetch();
      void tradesQ.refetch();
    },
  };
}
