import { useEffect, type ReactNode } from 'react';
import '@app/bootstrap/initI18n';
import { useAppStore } from '@core/state/appStore';
import { initNetworkMonitor } from '@core/offline/netInfo';

export function AppProviders({ children }: { children: ReactNode }) {
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void initNetworkMonitor((state) => setOnline(state.isConnected)).then((remove) => {
      unsub = remove;
    });
    return () => unsub?.();
  }, [setOnline]);

  return <>{children}</>;
}
