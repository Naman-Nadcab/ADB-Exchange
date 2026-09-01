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

export function useForexCandles(symbol: string, timeframe: string | null) {
  const [view, setView] = useState<ForexCandleView>(() => loadingForexCandleView(symbol, timeframe ?? undefined));
  const genRef = useRef(0);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    const nextSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    genRef.current += 1;
    const generation = genRef.current;
    symbolRef.current = nextSymbol;
    const controller = new AbortController();
    setView(loadingForexCandleView(nextSymbol, timeframe ?? undefined));

    void (async () => {
      const res = await forexApi.candles(
        { symbol: nextSymbol, timeframe: timeframe ?? undefined, limit: DEFAULT_LIMIT },
        controller.signal
      );
      const incoming = { symbol: nextSymbol, generation };
      const active = { symbol: symbolRef.current, generation: genRef.current };
      if (isStaleCandleRequest(active, incoming)) return;

      const u = unwrap(res);
      setView(
        interpretForexCandleResult({
          symbol: nextSymbol,
          timeframe: timeframe ?? undefined,
          ok: u.ok,
          data: u.ok ? u.data : undefined,
          error: u.ok ? undefined : u.error,
        })
      );
    })().catch((err: unknown) => {
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

    return () => {
      controller.abort();
    };
  }, [symbol, timeframe]);

  return view;
}
