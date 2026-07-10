import { useEffect, type ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useAppStore } from '@core/state/appStore';
import { initNetworkMonitor } from '@core/offline/netInfo';

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: { app_name: 'METHErium' } } },
});

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
