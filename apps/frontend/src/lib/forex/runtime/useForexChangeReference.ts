'use client';

import { useEffect, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { interpretForexCandleResult } from '../models/candles';
import type { ForexChangeReference } from '../models/change-pct';

const REFERENCE_TIMEFRAME = '1D';
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Market Watch is a sidebar, not a screener — cap the fan-out. */
const MAX_SYMBOLS = 24;

type CacheEntry = { at: number; reference: ForexChangeReference | null };

const cache = new Map<string, CacheEntry>();

export type ForexReferenceStatus = 'loading' | 'ready' | 'unavailable';

export interface ForexChangeReferences {
  references: Record<string, ForexChangeReference | null>;
  status: Record<string, ForexReferenceStatus>;
}

function fresh(entry: CacheEntry | undefined): boolean {
  return entry != null && Date.now() - entry.at < CACHE_TTL_MS;
}

/**
 * Session-open reference per symbol, from the backend candle endpoint.
 * A symbol with no provider history resolves to null so the UI can say n/a
 * instead of inventing a baseline.
 */
export function useForexChangeReferences(symbols: string[]): ForexChangeReferences {
  const key = symbols.join(',');
  const [state, setState] = useState<ForexChangeReferences>({ references: {}, status: {} });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNonce((n) => n + 1), CACHE_TTL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const list = key ? key.split(',').slice(0, MAX_SYMBOLS) : [];
    if (list.length === 0) return;
    let cancelled = false;

    setState((cur) => {
      const references = { ...cur.references };
      const status = { ...cur.status };
      for (const symbol of list) {
        const hit = cache.get(symbol);
        if (fresh(hit)) {
          references[symbol] = hit!.reference;
          status[symbol] = hit!.reference ? 'ready' : 'unavailable';
        } else if (status[symbol] == null) {
          status[symbol] = 'loading';
        }
      }
      return { references, status };
    });

    void (async () => {
      for (const symbol of list) {
        if (cancelled) return;
        if (fresh(cache.get(symbol))) continue;
        let reference: ForexChangeReference | null = null;
        try {
          const raw = await forexApi.candles({ symbol, timeframe: REFERENCE_TIMEFRAME, limit: 2 });
          const res = unwrap(raw);
          const view = interpretForexCandleResult({
            symbol,
            timeframe: REFERENCE_TIMEFRAME,
            ok: res.ok,
            data: res.ok ? res.data : undefined,
            error: res.ok ? undefined : res.error,
          });
          const last = view.status === 'READY' ? view.candles[view.candles.length - 1] : undefined;
          if (last) {
            reference = {
              symbol,
              open: last.open,
              timestamp: last.timestamp,
              timeframe: REFERENCE_TIMEFRAME,
              source: view.source ?? 'EXTERNAL',
            };
          }
        } catch {
          reference = null;
        }
        cache.set(symbol, { at: Date.now(), reference });
        if (cancelled) return;
        setState((cur) => ({
          references: { ...cur.references, [symbol]: reference },
          status: { ...cur.status, [symbol]: reference ? 'ready' : 'unavailable' },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  return state;
}
