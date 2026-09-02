'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isForexTradePath } from '@/lib/forex/routes';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

/** Apply /forex/trade?symbol=&timeframe= once per navigation. */
export function ForexDeepLinkSync() {
  const pathname = usePathname() ?? '';
  const search = useSearchParams();
  const applyDeepLink = useForexWorkspaceStore((s) => s.applyDeepLink);
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!isForexTradePath(pathname)) return;
    const symbol = search?.get('symbol');
    const timeframe = search?.get('timeframe') ?? search?.get('tf');
    if (!symbol && !timeframe) return;
    const key = `${pathname}?${symbol ?? ''}|${timeframe ?? ''}`;
    if (applied.current === key) return;
    applied.current = key;
    applyDeepLink(symbol, timeframe);
  }, [pathname, search, applyDeepLink]);

  return null;
}
