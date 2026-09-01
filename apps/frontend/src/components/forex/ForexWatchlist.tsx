'use client';

import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';
import { ForexSymbolSearch } from './ForexSymbolSearch';

export function ForexWatchlist() {
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const marketOpen = sessions?.eligibility.open ?? false;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]" aria-label="Watchlist">
      <div className="flex h-8 items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
        Watchlist
      </div>
      <ForexSymbolSearch />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-stone-50 font-medium text-stone-500 dark:bg-[#16181b]">
            <tr>
              <th className="px-2 py-1 font-medium">Symbol</th>
              <th className="px-1 py-1 font-medium">Bid</th>
              <th className="px-1 py-1 font-medium">Ask</th>
              <th className="px-1 py-1 font-medium">Spr</th>
              <th className="px-1 py-1 font-medium">Q</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((symbol) => {
              const inst = instruments[symbol];
              const q = quotes[symbol];
              const stale = !q || isQuoteStale(q);
              const digits = inst?.digits ?? 5;
              return (
                <tr
                  key={symbol}
                  className={cn(
                    'cursor-pointer border-t border-stone-100 dark:border-stone-800',
                    selected === symbol && 'bg-stone-100 dark:bg-stone-800/80'
                  )}
                >
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="w-full text-left font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                      onClick={() => setSelected(symbol)}
                    >
                      {inst?.displaySymbol ?? symbol}
                    </button>
                  </td>
                  <td className="px-1 py-1 font-mono text-emerald-700 dark:text-emerald-400">{q ? fxNum(q.bid, digits) : '—'}</td>
                  <td className="px-1 py-1 font-mono text-rose-700 dark:text-rose-400">{q ? fxNum(q.ask, digits) : '—'}</td>
                  <td className="px-1 py-1 font-mono text-stone-500">{q?.spreadPips ?? '—'}</td>
                  <td className="px-1 py-1 font-mono">
                    <span className={stale ? 'text-amber-600' : 'text-stone-400'}>
                      {q ? (stale ? q.freshness : q.quality) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {watchlist.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-stone-500">Search a Forex symbol to add it. No Crypto symbols.</p>
        ) : null}
      </div>
      <div className="border-t border-stone-200 px-2 py-1 font-mono text-[10px] text-stone-400 dark:border-stone-800">
        Session {marketOpen ? 'OPEN' : sessions?.eligibility.reason ?? '—'}. Change % is not provided by the Forex quote API.
      </div>
    </aside>
  );
}
