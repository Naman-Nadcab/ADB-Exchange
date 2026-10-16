'use client';

import { useEffect, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import {
  deriveForexProductGates,
  FOREX_PRODUCT_GATES_DEFAULT,
  type ForexProductGates,
} from '../capabilities/product-gates';
import { useForexSession } from '../runtime/useForexSession';
import { useForexStore } from '../state/store';

export function useForexProductGates(): { gates: ForexProductGates; loading: boolean } {
  const session = useForexSession();
  const authed = session.authed;
  const tradingConfig = useForexStore((s) => s.tradingConfig);
  const [gates, setGates] = useState<ForexProductGates>(FOREX_PRODUCT_GATES_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.resolving) {
      setLoading(true);
      return;
    }
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
  }, [authed, session.resolving, tradingConfig?.executionMode]);

  return { gates, loading };
}
