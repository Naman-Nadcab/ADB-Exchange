'use client';

import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';

export function ForexMarketStrip() {
  const quotes = useForexStore((s) => s.quotes);
  const instruments = useForexStore((s) => s.instruments);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const symbols = watchlist.filter((s) => instruments[s] || quotes[s]);

  return (
    <div
      className="flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-950"
      role="list"
      aria-label="Market strip"
    >
      {symbols.length === 0 ? (
        <div className="flex items-center px-3 text-[11px] text-stone-500">Waiting for Forex instruments…</div>
      ) : (
        symbols.map((symbol) => {
          const q = quotes[symbol];
          const inst = instruments[symbol];
          const stale = !q || isQuoteStale(q);
          const active = symbol === selected;
          return (
            <button
              key={symbol}
              type="button"
              role="listitem"
              onClick={() => setSelected(symbol)}
              className={cn(
                'flex min-w-[148px] items-center gap-2 px-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-400',
                active ? 'bg-white dark:bg-[#16181b]' : 'bg-stone-50 hover:bg-white dark:bg-[#0e1012] dark:hover:bg-[#16181b]'
              )}
            >
              <span className="font-mono text-[11px] font-medium text-stone-800 dark:text-stone-200">
                {inst?.displaySymbol ?? symbol}
              </span>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{q ? fxNum(q.bid, inst?.digits ?? 5) : '—'}</span>
              <span className="font-mono text-[11px] text-rose-700 dark:text-rose-400">{q ? fxNum(q.ask, inst?.digits ?? 5) : '—'}</span>
              <span className={cn('font-mono text-[10px]', stale ? 'text-amber-600' : 'text-stone-400')}>
                {q ? (stale ? q.freshness : q.spreadPips) : ''}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
