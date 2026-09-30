'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MARKETS_HREF, ORDERS_HREF, P2P_HREF, ROUTES, WALLET_HREF } from '@/lib/routes';
import { SPOT_TRADE_HREF } from '@/lib/tier1-canonical-routes';

type IdleWindow = Window & {
  __metheriumWarmupDone?: boolean;
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const PREFETCH_ROUTES = [
  ROUTES.home,
  MARKETS_HREF,
  SPOT_TRADE_HREF,
  P2P_HREF,
  WALLET_HREF,
  ORDERS_HREF,
  ROUTES.earn,
];

/**
 * Warm route bundles after first paint so click-to-open feels instant.
 * We also prewarm the Spot terminal chunk because it's the heaviest user page.
 */
export function UserRouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as IdleWindow;
    if (w.__metheriumWarmupDone) return;
    w.__metheriumWarmupDone = true;

    let cancelled = false;
    const runWarmup = async () => {
      if (cancelled) return;
      for (const route of PREFETCH_ROUTES) {
        try {
          router.prefetch(route);
        } catch {
          // Ignore prefetch errors; navigation still works normally.
        }
      }
      try {
        await import('@/components/trade/SpotTradingGrid');
      } catch {
        // Ignore chunk warmup errors; route-level dynamic import remains fallback-safe.
      }
    };

    const useIdleCallback = typeof w.requestIdleCallback === 'function';
    const idleId = useIdleCallback
      ? w.requestIdleCallback!(() => {
          void runWarmup();
        }, { timeout: 1800 })
      : window.setTimeout(() => {
          void runWarmup();
        }, 350);

    return () => {
      cancelled = true;
      if (useIdleCallback && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId);
      else clearTimeout(idleId as number);
    };
  }, [router]);

  return null;
}
