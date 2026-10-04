'use client';

import { useEffect, useRef, useState, useCallback, useMemo, type RefObject } from 'react';
import { LightweightChartsAdapter } from './LightweightChartsAdapter';
import { getChartCandles } from './getChartCandles';
import type { ChartTheme, CandleData } from './ChartAdapter';

const CHART_MOUNT_ID = 'chart-mount';

export function useChartAdapter(
  symbol: string,
  intervalSeconds: number,
  theme: ChartTheme = 'dark',
  viewMode: 'chart' | 'depth' = 'chart',
  pricePrecision: number = 6,
  /** When the shared trade stream is live, do not poll candles again. */
  liveStream: boolean = false
): {
  adapterRef: RefObject<LightweightChartsAdapter | null>;
  chartError: string | null;
  chartLoading: boolean;
  chartEmpty: boolean;
  chartStale: boolean;
  chartStaleReason: string | null;
  chartLastUpdatedAtMs: number | null;
  retryChart: () => void;
} {
  const adapterRef = useRef<LightweightChartsAdapter | null>(null);
  const inflightRef = useRef(0);
  const [dataError, setDataError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const chartError = useMemo(() => dataError ?? initError ?? null, [dataError, initError]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartEmpty, setChartEmpty] = useState(false);
  const [chartStale, setChartStale] = useState(false);
  const [chartStaleReason, setChartStaleReason] = useState<string | null>(null);
  const [chartLastUpdatedAtMs, setChartLastUpdatedAtMs] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastGoodCandlesRef = useRef<Map<string, { candles: CandleData[]; updatedAtMs: number }>>(new Map());
  /** Latest fetched candles for current symbol/interval; applied when adapter is created (fixes init race). */
  const lastCandlesRef = useRef<CandleData[] | null>(null);

  const retryChart = useCallback(() => {
    setDataError(null);
    setInitError(null);
    setChartStale(false);
    setChartStaleReason(null);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (viewMode === 'depth') {
      adapterRef.current?.destroy();
      adapterRef.current = null;
      return;
    }
    const el = document.getElementById(CHART_MOUNT_ID);
    if (!el) return;

    const syncAdapter = () => {
      if (!el.isConnected) return;
      const rect = el.getBoundingClientRect();
      const hasSize = rect.width >= 2 && rect.height >= 2;
      if (!adapterRef.current) {
        if (!hasSize) return;
        try {
          const adapter = new LightweightChartsAdapter();
          adapterRef.current = adapter;
          adapter.init(el, theme);
          adapter.setPricePrecision(pricePrecision);
          adapter.setLegendPrecision(pricePrecision);
          adapter.setIntervalSeconds(intervalSeconds);
          if (lastCandlesRef.current?.length) {
            adapter.setCandles(lastCandlesRef.current);
            adapter.fitContent?.();
          }
          setInitError(null);
        } catch (err) {
          try {
            adapterRef.current?.destroy();
          } catch {
            /* ignore */
          }
          adapterRef.current = null;
          setInitError(err instanceof Error ? err.message : 'Chart could not start');
        }
      } else {
        try {
          adapterRef.current.updateTheme?.(theme);
          adapterRef.current.setPricePrecision(pricePrecision);
          adapterRef.current.setLegendPrecision(pricePrecision);
        } catch (err) {
          console.error('[useChartAdapter] theme/precision update failed', err);
        }
      }
    };

    syncAdapter();
    const ro = new ResizeObserver(() => syncAdapter());
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [theme, viewMode, pricePrecision, intervalSeconds, retryCount]);

  useEffect(() => {
    return () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (viewMode === 'depth') {
      setChartLoading(false);
      setDataError(null);
      setInitError(null);
      setChartEmpty(false);
      setChartStale(false);
      setChartStaleReason(null);
      return;
    }
    if (!symbol?.trim()) {
      setChartLoading(false);
      setDataError(null);
      setChartEmpty(false);
      setChartStale(false);
      setChartStaleReason(null);
      lastCandlesRef.current = null;
      try {
        adapterRef.current?.setCandles([]);
      } catch {
        /* ignore */
      }
      adapterRef.current?.clearRealtimeState();
      return;
    }
    lastCandlesRef.current = null;
    try {
      adapterRef.current?.setCandles([]);
    } catch {
      /* ignore */
    }
    adapterRef.current?.clearRealtimeState();
    adapterRef.current?.setIntervalSeconds(intervalSeconds);
    setChartLoading(true);
    setDataError(null);
    setInitError(null);
    setChartEmpty(false);
    setChartStale(false);
    setChartStaleReason(null);
    let cancelled = false;
    const reqId = ++inflightRef.current;
    const ac = new AbortController();
    const cacheKey = `${symbol}::${intervalSeconds}`;

    const now = Math.floor(Date.now() / 1000);
    const sixMonthsSeconds = 60 * 60 * 24 * 30 * 6;
    const from = now - sixMonthsSeconds;
    /** First HTTP response only — smaller payload for fast first paint (backend min limit 50). */
    const INITIAL_CHART_LIMIT = 900;
    const BACKFILL_PAGE_LIMIT = 4000;
    const HARD_CAP = 300000;
    const INITIAL_FETCH_RETRIES = 3;
    const INITIAL_FETCH_RETRY_DELAY_MS = 700;

    const yieldToMain = () =>
      new Promise<void>((resolve) => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => resolve(), { timeout: 750 });
        } else {
          setTimeout(resolve, 4);
        }
      });

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    const fetchWithRetry = async (args: Parameters<typeof getChartCandles>[2]): Promise<CandleData[]> => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= INITIAL_FETCH_RETRIES; attempt += 1) {
        if (cancelled || inflightRef.current !== reqId || ac.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        try {
          return await getChartCandles(symbol, intervalSeconds, args);
        } catch (err) {
          lastErr = err;
          if (attempt >= INITIAL_FETCH_RETRIES) break;
          await wait(INITIAL_FETCH_RETRY_DELAY_MS * attempt);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('Failed to load chart data');
    };

    const run = async () => {
      try {
        const recent = await fetchWithRetry({
          from,
          to: now,
          limit: INITIAL_CHART_LIMIT,
          direction: 'desc',
          signal: ac.signal,
        });
        if (cancelled || inflightRef.current !== reqId) return;
        setDataError(null);
        lastCandlesRef.current = recent;
        const fetchedAt = Date.now();
        lastGoodCandlesRef.current.set(cacheKey, { candles: recent, updatedAtMs: fetchedAt });
        setChartLastUpdatedAtMs(fetchedAt);
        setChartEmpty(recent.length === 0);
        const adapter = adapterRef.current;
        if (adapter) {
          try {
            adapter.setIntervalSeconds(intervalSeconds);
            adapter.setCandles(recent);
            adapter.fitContent?.();
          } catch (err) {
            console.error('[useChartAdapter] setCandles failed', err);
            setInitError(err instanceof Error ? err.message : 'Chart failed to render candles');
          }
        }
        if (!cancelled && inflightRef.current === reqId) {
          setChartLoading(false);
        }

        try {
          let oldest = recent[0]?.time;
          let total = recent.length;
          const backfillPages: CandleData[][] = [];
          while (oldest && oldest > from && total < HARD_CAP) {
            if (cancelled || inflightRef.current !== reqId) return;
            await yieldToMain();
            const older = await getChartCandles(symbol, intervalSeconds, {
              from,
              to: now,
              cursor: oldest,
              limit: BACKFILL_PAGE_LIMIT,
              direction: 'desc',
              signal: ac.signal,
            });
            if (cancelled || inflightRef.current !== reqId) return;
            if (!older.length) break;
            backfillPages.push(older);
            oldest = older[0]?.time;
            total += older.length;
            if (older.length < BACKFILL_PAGE_LIMIT) break;
          }
          if (backfillPages.length && adapterRef.current) {
            try {
              const allOlder = backfillPages.flat();
              adapterRef.current.prependCandles?.(allOlder);
            } catch (err) {
              console.error('[useChartAdapter] prependCandles failed', err);
            }
          }
        } catch (backfillErr) {
          console.warn('[useChartAdapter] history backfill stopped', backfillErr);
        }
      } catch (err) {
        if (cancelled || inflightRef.current !== reqId) return;
        const cached = lastGoodCandlesRef.current.get(cacheKey);
        if (cached?.candles.length) {
          lastCandlesRef.current = cached.candles;
          try {
            adapterRef.current?.setIntervalSeconds(intervalSeconds);
            adapterRef.current?.setCandles(cached.candles);
            adapterRef.current?.fitContent?.();
          } catch (cacheErr) {
            console.warn('[useChartAdapter] cached candles render failed', cacheErr);
          }
          setChartLastUpdatedAtMs(cached.updatedAtMs);
          setChartEmpty(cached.candles.length === 0);
          setChartStale(true);
          const staleMsg = err instanceof Error ? err.message : 'Failed to refresh chart data';
          setChartStaleReason(staleMsg);
          // Keep chart usable on transient backend failures, but expose stale status in UI.
          setDataError(null);
          console.warn('[useChartAdapter] using cached candles after fetch failure', err);
        } else {
          setChartEmpty(true);
          const message = err instanceof Error ? err.message : 'Failed to load chart data';
          setDataError(message);
        }
      } finally {
        if (!cancelled && inflightRef.current === reqId) setChartLoading(false);
      }
    };
    run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [symbol, intervalSeconds, viewMode, retryCount]);

  // Periodic resync: re-fetch the last 5 bars every 30s so closed bars stay accurate.
  // Uses prependCandles which dedupes by time — safe to call without a full reload.
  useEffect(() => {
    if (viewMode === 'depth' || chartLoading || !symbol?.trim()) return;
    const activeSymbol = symbol;
    const activeInterval = intervalSeconds;
    let resyncAc: AbortController | null = null;
    const resync = async () => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      if (resyncAc) resyncAc.abort();
      const ac = new AbortController();
      resyncAc = ac;
      try {
        const now = Math.floor(Date.now() / 1000);
        const fillingEmpty = lastCandlesRef.current.length === 0;
        const fresh = await getChartCandles(activeSymbol, activeInterval, {
          to: now,
          limit: fillingEmpty ? 500 : 5,
          direction: 'desc',
          signal: ac.signal,
        });
        if (!fresh.length) return;
        if (activeSymbol !== symbol || activeInterval !== intervalSeconds) return;
        if (lastCandlesRef.current.length === 0) {
          lastCandlesRef.current = fresh;
          adapter.setIntervalSeconds(activeInterval);
          adapter.setCandles(fresh);
          adapter.fitContent?.();
          setChartEmpty(false);
        } else {
          adapter.prependCandles?.(fresh);
        }
        // Recover from transient fetch failures: once we have fresh candles again,
        // clear stale banner and refresh "last update" timestamp.
        const newest = fresh[fresh.length - 1];
        setChartLastUpdatedAtMs(newest ? newest.time * 1000 : Date.now());
        setChartStale(false);
        setChartStaleReason(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setChartStale(true);
        setChartStaleReason(err instanceof Error ? `Resync failed: ${err.message}` : 'Resync failed');
      } finally {
        if (resyncAc === ac) resyncAc = null;
      }
    };
    const waitingForHistory = lastCandlesRef.current.length === 0;
    if (liveStream && !waitingForHistory) return;
    const id = window.setInterval(resync, waitingForHistory ? 5_000 : 15_000);
    return () => {
      window.clearInterval(id);
      if (resyncAc) {
        resyncAc.abort();
        resyncAc = null;
      }
    };
  }, [symbol, intervalSeconds, viewMode, chartLoading, liveStream]);

  return { adapterRef, chartError, chartLoading, chartEmpty, chartStale, chartStaleReason, chartLastUpdatedAtMs, retryChart };
}
