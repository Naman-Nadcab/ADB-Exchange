'use client';

import { useMemo, useState } from 'react';
import type { ForexAssetClass } from '@/lib/forex/models/types';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { type ForexMwFilter, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';
import { ForexSymbolSearch } from './ForexSymbolSearch';

const FILTERS: Array<{ id: ForexMwFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: '★' },
  { id: 'fx_major', label: 'Majors' },
  { id: 'fx_cross', label: 'Crosses' },
  { id: 'metal', label: 'Metals' },
];

export function ForexWatchlist() {
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const favorites = useForexWorkspaceStore((s) => s.favorites);
  const mwFilter = useForexWorkspaceStore((s) => s.mwFilter);
  const setMwFilter = useForexWorkspaceStore((s) => s.setMwFilter);
  const toggleFavorite = useForexWorkspaceStore((s) => s.toggleFavorite);
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);
  const marketOpen = sessions?.eligibility.open ?? false;
  const [menu, setMenu] = useState<{ x: number; y: number; symbol: string } | null>(null);

  const rows = useMemo(() => {
    return watchlist.filter((symbol) => {
      if (mwFilter === 'all') return true;
      if (mwFilter === 'favorites') return favorites.includes(symbol);
      const cls = instruments[symbol]?.assetClass as ForexAssetClass | undefined;
      return cls === mwFilter;
    });
  }, [watchlist, mwFilter, favorites, instruments]);

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-r border-border bg-card" aria-label="Market watch">
      <div className="flex h-6 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Market Watch</span>
        <span className="font-mono text-[9px] text-muted-foreground">{rows.length}/{watchlist.length}</span>
      </div>
      <ForexSymbolSearch />
      <div className="forex-chrome-strip flex gap-0.5 overflow-x-auto border-b border-border px-1 py-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={mwFilter === f.id}
            onClick={() => setMwFilter(f.id)}
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              mwFilter === f.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-1 border-b border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
        <span />
        <span>Symbol</span>
        <span className="w-14 text-right">Bid</span>
        <span className="w-14 text-right">Ask</span>
        <span className="w-7 text-right">Spr</span>
        <span className="w-8 text-right">Chg%</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" onClick={() => setMenu(null)}>
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">
            {mwFilter === 'favorites' ? 'No favorites yet. Star a symbol.' : 'No symbols in this filter.'}
          </p>
        ) : (
          rows.map((symbol) => {
            const inst = instruments[symbol];
            const q = quotes[symbol];
            const stale = !q || isQuoteStale(q);
            const digits = inst?.digits ?? 5;
            const active = selected === symbol;
            const fav = favorites.includes(symbol);
            return (
              <button
                key={symbol}
                type="button"
                onClick={() => focusSymbol(symbol)}
                onDoubleClick={() => {
                  focusSymbol(symbol);
                  setPanel('ticket', true);
                  setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  focusSymbol(symbol);
                  setMenu({ x: e.clientX, y: e.clientY, symbol });
                }}
                className={cn(
                  'fx-mt5-row grid w-full grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-1 border-l-2 border-t border-border/50 px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'fx-mt5-row--active border-l-primary' : 'border-l-transparent'
                )}
              >
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={fav ? 'Remove favorite' : 'Add favorite'}
                  className={cn('w-3 text-[10px]', fav ? 'text-primary' : 'text-muted-foreground/50')}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(symbol);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(symbol);
                    }
                  }}
                >
                  {fav ? '★' : '☆'}
                </span>
                <span className="truncate font-mono text-[11px] tabular-nums">{inst?.displaySymbol ?? symbol}</span>
                <span className="eda-quote w-14 text-right font-mono text-[11px] text-buy">{q ? fxNum(q.bid, digits) : '—'}</span>
                <span className="eda-quote w-14 text-right font-mono text-[11px] text-sell">{q ? fxNum(q.ask, digits) : '—'}</span>
                <span className="w-7 text-right font-mono text-[10px] text-muted-foreground">{q?.spreadPips ?? '—'}</span>
                <span
                  className={cn('w-8 text-right font-mono text-[9px]', stale ? 'text-primary' : 'text-muted-foreground')}
                  title="Change % unavailable from quote feed"
                >
                  n/a
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-[9px] text-muted-foreground">
        Session {marketOpen ? 'open' : sessions?.eligibility.reason ?? '—'} · Dbl-click New Order · Chg% n/a
      </div>
      {menu ? (
        <div
          className="fixed z-50 min-w-[160px] border border-border bg-card py-1 text-[11px] shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <MenuItem
            label="Focus chart"
            onClick={() => {
              focusSymbol(menu.symbol);
              setMenu(null);
            }}
          />
          <MenuItem
            label="New Order"
            onClick={() => {
              focusSymbol(menu.symbol);
              setPanel('ticket', true);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
              setMenu(null);
            }}
          />
          <MenuItem
            label={favorites.includes(menu.symbol) ? 'Remove favorite' : 'Add favorite'}
            onClick={() => {
              toggleFavorite(menu.symbol);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Market buy draft"
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
              setMenu(null);
            }}
          />
          <MenuItem
            label="Market sell draft"
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'sell' });
              setMenu(null);
            }}
          />
          <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" onClick={() => setMenu(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={onClick}>
      {label}
    </button>
  );
}
