'use client';

import { useMemo, useState } from 'react';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export function ForexSymbolSearch() {
  const instruments = useForexStore((s) => s.instruments);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const toggle = useForexWorkspaceStore((s) => s.toggleWatchlistSymbol);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = Object.values(instruments);
    const n = q.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!n) return list.slice(0, 12);
    return list.filter(
      (i) => i.symbol.includes(n) || i.displaySymbol.replace('/', '').includes(n) || i.baseCurrency.includes(n)
    );
  }, [instruments, q]);

  return (
    <div className="border-b border-stone-200 p-2 dark:border-stone-800">
      <label className="sr-only" htmlFor="fx-symbol-search">
        Search Forex symbols
      </label>
      <input
        id="fx-symbol-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search EURUSD…"
        className="h-8 w-full rounded border border-stone-200 bg-white px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-700 dark:bg-[#0e1012]"
        autoComplete="off"
      />
      {q.trim() ? (
        <ul className="mt-1 max-h-40 overflow-auto text-[12px]" role="listbox">
          {rows.map((i) => (
            <li key={i.symbol}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:hover:bg-stone-800"
                onClick={() => {
                  setSelected(i.symbol);
                  if (!watchlist.includes(i.symbol)) toggle(i.symbol);
                  setQ('');
                }}
              >
                <span className="font-mono">{i.displaySymbol}</span>
                <span className="text-stone-400">{i.assetClass}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-1.5 py-1 text-stone-500">No Forex instrument matches.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
