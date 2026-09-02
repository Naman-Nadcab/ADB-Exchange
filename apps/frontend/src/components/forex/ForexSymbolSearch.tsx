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
    <div className="border-b border-border p-2">
      <label className="sr-only" htmlFor="fx-symbol-search">
        Search Forex symbols
      </label>
      <input
        id="fx-symbol-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search EURUSD…"
        className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoComplete="off"
      />
      {q.trim() ? (
        <ul className="mt-1 max-h-40 overflow-auto text-[12px]" role="listbox">
          {rows.map((i) => (
            <li key={i.symbol}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setSelected(i.symbol);
                  if (!watchlist.includes(i.symbol)) toggle(i.symbol);
                  setQ('');
                }}
              >
                <span className="font-mono">{i.displaySymbol}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{i.assetClass.replace('fx_', '')}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-1.5 py-1 text-muted-foreground">No Forex instrument matches.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
