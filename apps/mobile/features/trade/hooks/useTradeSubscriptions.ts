import { useEffect } from 'react';
import { useWs } from '@app/providers/WsProvider';
import { useAuthStore } from '@core/state/authStore';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { useTradeStore } from '@core/state/tradeStore';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';
import { useOrderbookBootstrap, useRecentTradesBootstrap } from './useTrade';
import { useMarketDataStore } from '@core/state/marketDataStore';

export function useTradeSubscriptions(symbol: string) {
  const { subscriptions, client } = useWs();
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const normalized = normalizeSymbol(symbol);

  useEffect(() => {
    const unsubs = [
      subscriptions.subscribeTicker(normalized),
      subscriptions.subscribeOrderbook(normalized),
      subscriptions.subscribeTrades(normalized),
    ];
    return () => unsubs.forEach((u) => u());
  }, [normalized, subscriptions]);

  useEffect(() => {
    if (!isAuthenticated) {
      useTradeStore.getState().setWsAuthenticated(false);
      return;
    }
    let cancelled = false;
    let cleanupPrivate: (() => void) | undefined;
    void (async () => {
      try {
        const { ticket } = await getSpotRepository().getWsTicket();
        if (cancelled) return;
        client.authenticate(ticket);
        const removeAuth = client.addGlobalHandler('auth_result', (msg) => {
          const m = msg as { success?: boolean };
          if (m.success) useTradeStore.getState().setWsAuthenticated(true);
        });
        const u1 = subscriptions.subscribeUserOrders();
        const u2 = subscriptions.subscribeUserTrades();
        cleanupPrivate = () => {
          removeAuth();
          u1();
          u2();
        };
      } catch {
        if (!cancelled) useTradeStore.getState().setWsAuthenticated(false);
      }
    })();
    return () => {
      cancelled = true;
      cleanupPrivate?.();
      useTradeStore.getState().setWsAuthenticated(false);
    };
  }, [isAuthenticated, client, subscriptions]);
}

export function useTradeScreenData(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  useTradeSubscriptions(normalized);
  const tickerQ = useOrderbookBootstrap(normalized);
  const tradesQ = useRecentTradesBootstrap(normalized);
  const orderbook = useMarketDataStore((s) => s.orderbooks[normalized]);
  const trades = useMarketDataStore((s) => s.trades[normalized]);

  useEffect(() => {
    if (tickerQ.data) {
      useMarketDataStore.getState().setOrderbook(normalized, { ...tickerQ.data, symbol: normalized });
    }
  }, [tickerQ.data, normalized]);

  useEffect(() => {
    if (tradesQ.data?.length) {
      useMarketDataStore.getState().appendTrades(normalized, tradesQ.data);
    }
  }, [tradesQ.data, normalized]);

  return { orderbook, trades, isLoading: tickerQ.isLoading };
}
