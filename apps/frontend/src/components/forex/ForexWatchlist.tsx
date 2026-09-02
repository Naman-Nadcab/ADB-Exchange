'use client';

import { useMemo } from 'react';
import type { ForexAssetClass } from '@/lib/forex/models/types';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';
import { ForexSymbolSearch } from './ForexSymbolSearch';

const GROUP_ORDER: Array<{ id: ForexAssetClass | 'other'; label: string }> = [
  { id: 'fx_major', label: 'Majors' },
  { id: 'fx_cross', label: 'Crosses' },
  { id: 'metal', label: 'Metals' },
  { id: 'other', label: 'Other' },
];

export function ForexWatchlist() {
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const marketOpen = sessions?.eligibility.open ?? false;

  const groups = useMemo(() => {
    const by: Record<string, string[]> = { fx_major: [], fx_cross: [], metal: [], other: [] };
    for (const symbol of watchlist) {
      const cls = instruments[symbol]?.assetClass;
      if (cls === 'fx_major' || cls === 'fx_cross' || cls === 'metal') by[cls].push(symbol);
      else by.other.push(symbol);
    }
    return by;
  }, [instruments, watchlist]);

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-r border-border bg-card" aria-label="Watchlist">
      <div className="flex h-8 items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Favorites
      </div>
      <ForexSymbolSearch />
      <div className="min-h-0 flex-1 overflow-auto">
        {watchlist.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">Search a Forex symbol to add it. No Crypto symbols.</p>
        ) : (
          GROUP_ORDER.map((group) => {
            const rows = groups[group.id] ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="sticky top-0 bg-muted/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <table className="w-full text-left text-[11px]">
                  <thead className="sr-only">
                    <tr>
                      <th>Symbol</th>
                      <th>Bid</th>
                      <th>Ask</th>
                      <th>Spread</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((symbol) => {
                      const inst = instruments[symbol];
                      const q = quotes[symbol];
                      const stale = !q || isQuoteStale(q);
                      const digits = inst?.digits ?? 5;
                      const status = !q ? 'Unavailable' : stale ? 'Stale' : q.status === 'TRADEABLE' ? 'Live' : q.status;
                      return (
                        <tr
                          key={symbol}
                          className={cn(
                            'cursor-pointer border-t border-border/70',
                            selected === symbol && 'bg-accent'
                          )}
                        >
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              className="w-full text-left font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => setSelected(symbol)}
                            >
                              {inst?.displaySymbol ?? symbol}
                            </button>
                          </td>
                          <td className="eda-quote px-1 py-1.5 font-mono text-buy">{q ? fxNum(q.bid, digits) : '—'}</td>
                          <td className="eda-quote px-1 py-1.5 font-mono text-sell">{q ? fxNum(q.ask, digits) : '—'}</td>
                          <td className="px-1 py-1.5 font-mono text-muted-foreground">{q?.spreadPips ?? '—'}</td>
                          <td className={cn('px-1 py-1.5 font-mono', stale ? 'text-primary' : 'text-muted-foreground')}>
                            {status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
        Session {marketOpen ? 'open' : sessions?.eligibility.reason ?? '—'}. Change % is not provided by the quote API.
      </div>
    </aside>
  );
}
