'use client';

import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import ThemeProvider from '@/components/ThemeProvider';
import { rehydrateAuthStore, useAuthStore } from '@/store/auth';
import { useLocalizedNotify } from '@/hooks/useLocalizedNotify';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { DisplayCurrencyProvider } from '@/context/DisplayCurrencyProvider';
import { LocalePreferenceSync } from '@/components/i18n/LocalePreferenceSync';
import { useTranslations } from 'next-intl';

/** Zustand unblock fallback if persist is slow (AuthProvider /me still needs `_hasHydrated`). */
const REHYDRATE_MAX_MS = 1200;

function readPersistedAuth(): { user?: unknown; isAuthenticated?: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { user?: unknown; isAuthenticated?: boolean } };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

function unblockAuthHydration() {
  const persisted = readPersistedAuth();
  const state = useAuthStore.getState();
  if (!state.isAuthenticated && persisted?.isAuthenticated && persisted.user && typeof persisted.user === 'object') {
    useAuthStore.setState({
      user: persisted.user as NonNullable<typeof state.user>,
      isAuthenticated: true,
    });
  }
  useAuthStore.getState().setHasHydrated(true);
  useAuthStore.getState().setLoading(false);
}

function QueryProvider({ children }: { children: React.ReactNode }) {
  const { error: notifyLocalizedError } = useLocalizedNotify();
  const tc = useTranslations('common');

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 1,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            placeholderData: keepPreviousData,
          },
          mutations: {
            retry: 0,
            onError: () => {
              notifyLocalizedError(tc('notifications.actionFailed'));
            },
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const warnedHydration = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!warnedHydration.current && typeof window !== 'undefined') {
        warnedHydration.current = true;
        console.warn('[Providers] Zustand persist slow — unblocking hydration (fail-open)');
      }
      unblockAuthHydration();
    }, REHYDRATE_MAX_MS);

    rehydrateAuthStore()
      .then(() => {
        unblockAuthHydration();
      })
      .catch(() => {
        unblockAuthHydration();
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => clearTimeout(timer);
  }, []);

  /** Never block the tree: QueryClient + theme + auth must wrap children from first paint. */
  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <AuthProvider>
            <DisplayCurrencyProvider>
              <LocalePreferenceSync />
              {children}
            </DisplayCurrencyProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
