'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { getForexAccessToken, hasForexBearer } from '../api/auth-token';
import { useForexStore } from '../state/store';
import { useForexWorkspaceStore } from '../state/workspace';
import { forexWsManager } from '../websocket/manager';
import { forexApi, unwrap } from '../api/client';
import { hydrateForexAll } from './hydrate';

const SESSION_POLL_MS = 20_000;

/**
 * REST hydrate first, then one Forex WS. On reconnect: hydrate again, then resume WS.
 */
export function useForexRuntime(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const started = useRef(false);
  const reconnectHydrate = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const store = useForexStore.getState();

    const unMsg = forexWsManager.onMessage((msg) => {
      useForexStore.getState().applyWs(msg);
    });
    const unState = forexWsManager.onState((state, detail) => {
      useForexStore.getState().setSocketState(state, detail ?? null);
      if (state === 'RECONNECTING') {
        reconnectHydrate.current = true;
      }
      if (state === 'CONNECTED' && reconnectHydrate.current) {
        reconnectHydrate.current = false;
        void hydrateForexAll();
      }
      if (state === 'CONNECTED') {
        forexWsManager.subscribeDefaults(hasForexBearer());
      }
    });
    const unPong = forexWsManager.onMessage((msg) => {
      if (msg.type === 'pong') useForexStore.getState().setLastPong(Date.now());
    });

    void (async () => {
      await hydrateForexAll();
      if (cancelled) return;
      const instruments = Object.keys(useForexStore.getState().instruments);
      const ws = useForexWorkspaceStore.getState();
      if (instruments.length && !instruments.includes(ws.selectedSymbol)) {
        ws.setSelectedSymbol(instruments[0] ?? 'EURUSD');
      }
      if (instruments.length && ws.watchlist.every((s) => !instruments.includes(s))) {
        ws.setWatchlist(instruments.slice(0, 8));
      }
      forexWsManager.connect({ token: getForexAccessToken() });
      started.current = true;
      void store;
    })();

    const poll = setInterval(() => {
      void forexApi.sessions().then((res) => {
        const u = unwrap(res);
        if (u.ok) useForexStore.getState().applyPublicHydrate({ sessions: u.data });
      });
    }, SESSION_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      unMsg();
      unState();
      unPong();
      forexWsManager.disconnect();
    };
  }, [isAuthenticated, accessToken]);
}
