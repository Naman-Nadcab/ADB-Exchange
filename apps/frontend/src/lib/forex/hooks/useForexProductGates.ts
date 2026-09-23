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
      const list = unwrap(await forexApi.listAccounts());
      if (cancelled) return;
      if (list.ok) {
        setGates(
          deriveForexProductGates({
            realForex: list.data.realForex,
            executionMode: list.data.executionMode,
            source: list.data.source,
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
