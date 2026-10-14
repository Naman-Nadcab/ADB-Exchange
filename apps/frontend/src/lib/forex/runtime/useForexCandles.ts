'use client';

import { useEffect, useRef, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import {
  interpretForexCandleResult,
  isStaleCandleRequest,
  loadingForexCandleView,
  type ForexCandleView,
} from '../models/candles';
import { normalizeForexError } from '../models/errors';

const DEFAULT_LIMIT = 300;
/** History is fetched once and shared. The forming candle is applied from the quote store. */
const HISTORY_TTL_MS = 60_000;

type CacheEntry = { at: number; view: ForexCandleView };
const historyCache = new Map<string, CacheEntry>();
const historyInflight = new Map<string, Promise<ForexCandleView>>();

function historyKey(symbol: string, timeframe: string | null): string {
  return `${symbol}|${timeframe ?? ''}`;
}

export function useForexCandles(symbol: string, timeframe: string | null) {
  const [view, setView] = useState<ForexCandleView>(() => loadingForexCandleView(symbol, timeframe ?? undefined));
  const genRef = useRef(0);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    const nextSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    genRef.current += 1;
    const generation = genRef.current;
    symbolRef.current = nextSymbol;
    const key = historyKey(nextSymbol, timeframe);
    const cached = historyCache.get(key);
    if (cached && Date.now() - cached.at < HISTORY_TTL_MS) {
      setView(cached.view);
      return;
    }
    setView(loadingForexCandleView(nextSymbol, timeframe ?? undefined));

    let pending = historyInflight.get(key);
    if (!pending) {
      pending = (async () => {
        const res = await forexApi.candles({
          symbol: nextSymbol,
          timeframe: timeframe ?? undefined,
          limit: DEFAULT_LIMIT,
        });
        const u = unwrap(res);
        const view = interpretForexCandleResult({
          symbol: nextSymbol,
          timeframe: timeframe ?? undefined,
          ok: u.ok,
          data: u.ok ? u.data : undefined,
          error: u.ok ? undefined : u.error,
        });
        if (view.status === 'READY') historyCache.set(key, { at: Date.now(), view });
        return view;
      })().finally(() => {
        if (historyInflight.get(key) === pending) historyInflight.delete(key);
      });
      historyInflight.set(key, pending);
    }

    void pending.then((view) => {
      const incoming = { symbol: nextSymbol, generation };
      const active = { symbol: symbolRef.current, generation: genRef.current };
      if (isStaleCandleRequest(active, incoming)) return;
      setView(view);
    }).catch((err: unknown) => {
      const incoming = { symbol: nextSymbol, generation };
      const active = { symbol: symbolRef.current, generation: genRef.current };
      if (isStaleCandleRequest(active, incoming)) return;
      const error = normalizeForexError(err, err instanceof Error ? err.message : 'Forex candle request failed');
      if (error.code === 'ABORTED') return;
      setView(
        interpretForexCandleResult({
          symbol: nextSymbol,
          timeframe: timeframe ?? undefined,
          ok: false,
          error,
        })
      );
    });

  }, [symbol, timeframe]);

  return view;
}
