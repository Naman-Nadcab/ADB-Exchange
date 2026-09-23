'use client';

import { useEffect, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { hasForexPrivateSession } from '../api/auth-token';
import {
  deriveForexProductGates,
  FOREX_PRODUCT_GATES_DEFAULT,
  type ForexProductGates,
} from '../capabilities/product-gates';
import { useForexStore } from '../state/store';
import { useAuthStore } from '@/store/auth';

export function useForexProductGates(): { gates: ForexProductGates; loading: boolean } {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const tradingConfig = useForexStore((s) => s.tradingConfig);
  const [gates, setGates] = useState<ForexProductGates>(FOREX_PRODUCT_GATES_DEFAULT);
  const [loading, setLoading] = useState(authed);

  useEffect(() => {
    if (!authed) {
      setGates(FOREX_PRODUCT_GATES_DEFAULT);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [list, readiness] = await Promise.all([forexApi.listAccounts(), forexApi.getLiveReadiness()]);
      if (cancelled) return;
      const listRes = unwrap(list);
      const readyRes = unwrap(readiness);
      if (listRes.ok) {
        setGates(
          deriveForexProductGates({
            realForex: listRes.data.realForex,
            executionMode: listRes.data.executionMode,
            source: listRes.data.source,
            readiness: readyRes.ok ? readyRes.data : undefined,
          })
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, tradingConfig?.executionMode]);

  return { gates, loading };
}
