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
      className="flex h-8 shrink-0 items-stretch gap-px overflow-x-auto border-b border-border bg-muted/30"
      role="list"
      aria-label="Market strip"
    >
      {symbols.length === 0 ? (
        <div className="flex items-center px-3 text-[11px] text-muted-foreground">Loading instruments…</div>
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
                'flex min-w-[168px] items-center gap-2 border-b-2 px-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active ? 'border-primary bg-card' : 'border-transparent bg-transparent hover:bg-accent/50'
              )}
            >
              <span className="font-mono text-[11px] font-semibold">{inst?.displaySymbol ?? symbol}</span>
              <span className="eda-quote font-mono text-[11px] text-buy">{q ? fxNum(q.bid, inst?.digits ?? 5) : '—'}</span>
              <span className="eda-quote font-mono text-[11px] text-sell">{q ? fxNum(q.ask, inst?.digits ?? 5) : '—'}</span>
              <span className={cn('ml-auto font-mono text-[10px]', stale ? 'text-primary' : 'text-muted-foreground')}>
                {q ? (stale ? 'Stale' : q.spreadPips) : ''}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
