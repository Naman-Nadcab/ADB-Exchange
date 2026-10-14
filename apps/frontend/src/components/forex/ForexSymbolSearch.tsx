'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export function ForexSymbolSearch() {
  const t = useTranslations('forex.symbolSearch');
  const instruments = useForexStore((s) => s.instruments);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const toggle = useForexWorkspaceStore((s) => s.toggleWatchlistSymbol);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const list = Object.values(instruments);
    const n = q.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!n) return [];
    return list.filter(
      (i) => i.symbol.includes(n) || i.displaySymbol.replace('/', '').includes(n) || i.baseCurrency.includes(n)
    );
  }, [instruments, q]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQ('');
  }

  return (
    <div className="relative ml-auto shrink-0">
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={t('label')}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.2 10.2 L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 border border-border bg-card p-1 shadow-lg">
          <input
            ref={inputRef}
            id="fx-symbol-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            placeholder={t('placeholder')}
            aria-label={t('label')}
            className="h-6 w-full rounded border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoComplete="off"
          />
          {q.trim() ? (
            <ul className="mt-1 max-h-40 overflow-auto text-[11px]" role="listbox">
              {rows.map((i) => (
                <li key={i.symbol}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-1 py-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => {
                      setSelected(i.symbol);
                      if (!watchlist.includes(i.symbol)) toggle(i.symbol);
                      close();
                    }}
                  >
                    <span className="font-mono">{i.displaySymbol}</span>
                    <span className="text-[9px] uppercase text-muted-foreground">{i.assetClass.replace('fx_', '')}</span>
                  </button>
                </li>
              ))}
              {rows.length === 0 ? <li className="px-1 py-1 text-muted-foreground">{t('noMatches')}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
