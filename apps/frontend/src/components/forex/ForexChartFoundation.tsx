'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { isReservedForexTimeframe } from '@/lib/forex/models/candles';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { ForexLightweightChart } from './ForexLightweightChart';
import { fxNum } from './format';

function useHtmlDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function ForexChartFoundation() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const storedTf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const socketState = useForexStore((s) => s.socketState);
  const quotes = useForexStore((s) => s.quotes);
  const providers = useForexStore((s) => s.providerHealth);
  const connection = deriveDisplayConnection({ socketState, quotes, selectedSymbol: selected, providers });
  const dark = useHtmlDark();
  const [expanded, setExpanded] = useState(false);

  const requestedTf = storedTf && isReservedForexTimeframe(storedTf) ? storedTf : '1D';
  const candleView = useForexCandles(selected, requestedTf);
  const timeframes = candleView.supportedTimeframes.filter(isReservedForexTimeframe);
  const activeTf = timeframes.includes(requestedTf) ? requestedTf : timeframes[0] ?? requestedTf;

  const staleQuote = !quote || isQuoteStale(quote);
  const digits = inst?.digits ?? 5;
  const quoteLevels = useMemo(() => {
    if (!quote) return null;
    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    return { bid, ask };
  }, [quote]);

  const quoteFreshness =
    connection === 'DISCONNECTED' || connection === 'CONNECTING' || connection === 'RECONNECTING'
      ? 'DISCONNECTED'
      : connection === 'STALE' || staleQuote
        ? 'STALE'
        : quote
          ? 'LIVE'
          : 'LOADING';

  const banners: Array<{ tone: 'neutral' | 'warn' | 'error'; text: string }> = [];
  if (candleView.status === 'LOADING') {
    banners.push({ tone: 'neutral', text: `Loading ${inst?.displaySymbol ?? selected} history…` });
  } else if (candleView.status === 'NO_HISTORY') {
    banners.push({ tone: 'neutral', text: 'Historical Forex OHLC is currently unavailable.' });
  } else if (candleView.status === 'INVALID' || candleView.status === 'ERROR') {
    const err = candleView.error;
    banners.push({
      tone: 'error',
      text: err ? `${err.code}: ${err.message}` : 'FOREX_CANDLES_INVALID: Candle payload failed validation.',
    });
  }
  if (quoteFreshness === 'STALE') {
    banners.push({ tone: 'warn', text: 'Market data is stale.' });
  } else if (quoteFreshness === 'DISCONNECTED') {
    banners.push({ tone: 'warn', text: 'Market data disconnected.' });
  }

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f6f3] dark:bg-[#0c0d0f] ${
        expanded ? 'fixed inset-0 z-40' : ''
      }`}
      aria-label="Forex market chart"
    >
      <div className="flex h-8 min-w-0 items-center gap-2 overflow-x-auto border-b border-stone-200 px-2 dark:border-stone-800">
        <span className="shrink-0 font-mono text-[12px] font-medium">{inst?.displaySymbol ?? selected}</span>
        {activeTf ? <span className="shrink-0 font-mono text-[11px] text-stone-500">{activeTf}</span> : null}
        {quote ? (
          <>
            <span className="shrink-0 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
              BID {fxNum(quote.bid, digits)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-rose-700 dark:text-rose-400">
              ASK {fxNum(quote.ask, digits)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-stone-500">SPR {quote.spreadPips}</span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-stone-400">
              {quoteFreshness}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-stone-500">Waiting for backend quote…</span>
        )}
        {timeframes.length > 0 ? (
          <div className="ml-2 flex items-center gap-0.5" role="group" aria-label="Forex timeframes">
            {timeframes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={activeTf === t}
                onClick={() => setTf(t)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                  activeTf === t ? 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-white' : 'text-stone-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
        >
          {expanded ? 'Exit expand' : 'Expand'}
        </button>
      </div>

      <div className="relative min-h-[220px] flex-1">
        <ForexLightweightChart
          candles={candleView.status === 'READY' ? candleView.candles : []}
          quote={quoteLevels}
          dark={dark}
        />
        {banners.length > 0 ? (
          <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5">
            {banners.map((banner) => (
              <div
                key={banner.text}
                role={banner.tone === 'error' ? 'alert' : 'status'}
                className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
                  banner.tone === 'error'
                    ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100'
                    : banner.tone === 'warn'
                      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-100'
                      : 'border-stone-300 bg-white/95 text-stone-600 dark:border-stone-700 dark:bg-black/70 dark:text-stone-300'
                }`}
              >
                {banner.text}
                {banner.text.startsWith('Historical Forex OHLC') ? (
                  <span className="mt-1 block text-stone-500 dark:text-stone-400">
                    Live bid/ask continue from GET /quotes and fx.quote. Crypto GET /trading/candles is not used.
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
