'use client';

import { useMemo, useState } from 'react';
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
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const marketOpen = sessions?.eligibility.open ?? false;
  const [menu, setMenu] = useState<{ x: number; y: number; symbol: string } | null>(null);

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
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-r border-border bg-card" aria-label="Market watch">
      <div className="flex h-7 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Market Watch</span>
        <span className="font-mono text-[9px] text-muted-foreground">{watchlist.length}</span>
      </div>
      <ForexSymbolSearch />
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-1 border-b border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
        <span>Symbol</span>
        <span className="w-14 text-right">Bid</span>
        <span className="w-14 text-right">Ask</span>
        <span className="w-8 text-right">Spr</span>
        <span className="w-9 text-right">Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" onClick={() => setMenu(null)}>
        {watchlist.length === 0 ? (
          <p className="px-2.5 py-4 text-[11px] leading-relaxed text-muted-foreground">
            Search a Forex symbol to pin it here. Crypto symbols are not included.
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const rows = groups[group.id] ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="sticky top-0 z-[1] bg-muted/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                  {group.label}
                </p>
                {rows.map((symbol) => {
                  const inst = instruments[symbol];
                  const q = quotes[symbol];
                  const stale = !q || isQuoteStale(q);
                  const digits = inst?.digits ?? 5;
                  const status = !q ? '—' : stale ? 'Stale' : 'Live';
                  const active = selected === symbol;
                  return (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => focusSymbol(symbol)}
                      onDoubleClick={() => {
                        focusSymbol(symbol);
                        setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        focusSymbol(symbol);
                        setMenu({ x: e.clientX, y: e.clientY, symbol });
                      }}
                      className={cn(
                        'grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-1 border-l-2 border-t border-border/70 px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        active ? 'border-l-primary bg-primary/10' : 'border-l-transparent hover:bg-accent/60'
                      )}
                    >
                      <span className="truncate font-mono text-[11px] font-medium tabular-nums">{inst?.displaySymbol ?? symbol}</span>
                      <span className="eda-quote w-14 text-right font-mono text-[11px] text-buy">{q ? fxNum(q.bid, digits) : '—'}</span>
                      <span className="eda-quote w-14 text-right font-mono text-[11px] text-sell">{q ? fxNum(q.ask, digits) : '—'}</span>
                      <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{q?.spreadPips ?? '—'}</span>
                      <span className={cn('w-9 text-right font-mono text-[10px]', stale ? 'text-primary' : 'text-buy')}>
                        {status}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
        Session {marketOpen ? 'open' : sessions?.eligibility.reason ?? '—'} · Right-click for New order · Change % n/a
      </div>
      {menu ? (
        <div
          className="fixed z-50 min-w-[150px] rounded-md border border-border bg-card py-1 text-[11px] shadow-lg"
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
            label="New market buy"
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
              setMenu(null);
            }}
          />
          <MenuItem
            label="New market sell"
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'sell' });
              setMenu(null);
            }}
          />
          <MenuItem
            label="New limit order"
            onClick={() => {
              const q = quotes[menu.symbol];
              focusSymbol(menu.symbol);
              setTicketDraft({
                nonce: Date.now(),
                orderType: 'limit',
                side: 'buy',
                price: q?.bid ?? undefined,
              });
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
