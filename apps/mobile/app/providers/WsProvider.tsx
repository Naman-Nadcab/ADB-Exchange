import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { SpotWsClient } from '@core/ws/SpotWsClient';
import { SubscriptionManager } from '@core/ws/subscriptionManager';
import { getWsSpotUrl } from '@core/config/env';
import { useAppStore } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { useP2PStore } from '@core/state/p2pStore';

type WsContextValue = {
  client: SpotWsClient;
  subscriptions: SubscriptionManager;
};

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const isOnline = useAppStore((s) => s.isOnline);
  const authStatus = useAuthStore((s) => s.status);

  const value = useMemo(() => {
    let subscriptions: SubscriptionManager;
    const client = new SpotWsClient({
      getWsUrl: getWsSpotUrl,
      onReconnect: () => subscriptions?.resubscribeAll(),
    });
    subscriptions = new SubscriptionManager(client);
    return { client, subscriptions };
  }, []);

  useEffect(() => {
    if (isOnline) value.client.connect();
    else value.client.disconnect();
  }, [isOnline, value.client]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      value.subscriptions.clear();
      useMarketDataStore.getState().clearLive();
      useP2PStore.getState().clearOnLogout();
    }
  }, [authStatus, value.subscriptions]);

  useEffect(() => () => value.client.disconnect(), [value.client]);

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error('useWs requires WsProvider');
  return ctx;
}

export function useWsClient(): SpotWsClient {
  return useWs().client;
}
