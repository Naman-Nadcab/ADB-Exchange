'use client';

import { useMemo, useState } from 'react';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { fxNum } from './format';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;

export function ForexChartFoundation() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const tf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const [cross, setCross] = useState<{ x: number; y: number } | null>(null);
  const stale = !quote || isQuoteStale(quote);
  const digits = inst?.digits ?? 5;

  const scale = useMemo(() => {
    if (!quote) return null;
    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    const mid = (bid + ask) / 2;
    const pad = Math.max((ask - bid) * 8, Number(inst?.tickSize ?? '0.0001') * 40);
    return { min: mid - pad, max: mid + pad, bid, ask, mid };
  }, [quote, inst?.tickSize]);

  const yPct = (price: number) => {
    if (!scale) return 50;
    return ((scale.max - price) / (scale.max - scale.min)) * 100;
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f6f3] dark:bg-[#0c0d0f]" aria-label="Forex live quote chart">
      <div className="flex h-8 items-center gap-2 border-b border-stone-200 px-2 dark:border-stone-800">
        <span className="font-mono text-[12px] font-medium">{inst?.displaySymbol ?? selected}</span>
        {quote ? (
          <>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">BID {fxNum(quote.bid, digits)}</span>
            <span className="font-mono text-[11px] text-rose-700 dark:text-rose-400">ASK {fxNum(quote.ask, digits)}</span>
            <span className="font-mono text-[11px] text-stone-500">SPR {quote.spreadPips}</span>
            <span className="font-mono text-[10px] text-stone-400">{quote.source} · {quote.freshness}</span>
          </>
        ) : (
          <span className="text-[11px] text-stone-500">Waiting for backend quote…</span>
        )}
        <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Timeframe placeholders">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tf === t}
              title="Timeframes apply when a Forex candle endpoint exists. Historical OHLC is not available."
              onClick={() => setTf(t)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                tf === t ? 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-white' : 'text-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative min-h-[220px] flex-1"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setCross({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setCross(null)}
      >
        <svg className="absolute inset-0 h-full w-full" role="img" aria-label="Live bid and ask from Forex backend">
          {scale ? (
            <>
              <line x1="0" y1={`${yPct(scale.bid)}%`} x2="100%" y2={`${yPct(scale.bid)}%`} stroke="#0f766e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={`${yPct(scale.ask)}%`} x2="100%" y2={`${yPct(scale.ask)}%`} stroke="#be123c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
          {cross ? (
            <>
              <line x1={cross.x} y1="0" x2={cross.x} y2="100%" stroke="currentColor" strokeOpacity="0.25" />
              <line x1="0" y1={cross.y} x2="100%" y2={cross.y} stroke="currentColor" strokeOpacity="0.25" />
            </>
          ) : null}
        </svg>
        <div className="pointer-events-none absolute right-2 top-2 w-28 rounded border border-stone-200 bg-white/90 p-2 font-mono text-[10px] dark:border-stone-700 dark:bg-black/50">
          <div className="text-stone-400">Price scale</div>
          <div>Ask {quote ? fxNum(quote.ask, digits) : '—'}</div>
          <div>Bid {quote ? fxNum(quote.bid, digits) : '—'}</div>
          <div className="mt-1 text-stone-400">{stale ? 'Not live' : 'Live quote'}</div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 rounded border border-stone-300 bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-stone-600 dark:border-stone-700 dark:bg-black/70 dark:text-stone-300">
          Historical Forex OHLC is not available. This pane shows the live simulated bid/ask from GET /quotes and fx.quote.
          It is not candle history. Crypto GET /trading/candles is not used.
        </div>
      </div>
    </section>
  );
}
