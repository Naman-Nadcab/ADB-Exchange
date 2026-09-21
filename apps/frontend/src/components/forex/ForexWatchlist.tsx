'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ForexAssetClass } from '@/lib/forex/models/types';
import { describeForexChange } from '@/lib/forex/models/change-pct';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexChangeReferences } from '@/lib/forex/runtime/useForexChangeReference';
import { useForexStore } from '@/lib/forex/state/store';
import { type ForexMwFilter, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';
import { ForexSymbolSearch } from './ForexSymbolSearch';

const FILTER_IDS: ForexMwFilter[] = ['all', 'favorites', 'fx_major', 'fx_cross', 'metal'];

export function ForexWatchlist() {
  const tw = useTranslations('forex.watchlist');
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
  const [specSymbol, setSpecSymbol] = useState<string | null>(null);

  const rows = useMemo(() => {
    return watchlist.filter((symbol) => {
      if (mwFilter === 'all') return true;
      if (mwFilter === 'favorites') return favorites.includes(symbol);
      const cls = instruments[symbol]?.assetClass as ForexAssetClass | undefined;
      return cls === mwFilter;
    });
  }, [watchlist, mwFilter, favorites, instruments]);

  const changeRefs = useForexChangeReferences(rows);
  const anyReference = rows.some((s) => changeRefs.references[s] != null);

  const footerSession = marketOpen
    ? tw('sessionOpen')
    : sessions?.eligibility.reason ?? '—';
  const footerStatus = marketOpen ? tw('statusTradable') : tw('statusClosed');
  const changeNote = anyReference ? tw('changeWithRef') : tw('changeNoRef');

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-r border-border bg-card" aria-label={tw('ariaLabel')}>
      <div className="flex h-6 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tw('title')}</span>
        <span className="font-mono text-[9px] text-muted-foreground">{rows.length}/{watchlist.length}</span>
      </div>
      <ForexSymbolSearch />
      <div className="forex-chrome-strip flex gap-0.5 overflow-x-auto border-b border-border px-1 py-0.5">
        {FILTER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={mwFilter === id}
            onClick={() => setMwFilter(id)}
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              mwFilter === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tw(`filters.${id}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" onClick={() => setMenu(null)}>
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">
            {mwFilter === 'favorites' ? tw('emptyFavorites') : tw('emptyFilter')}
          </p>
        ) : (
          <div className="forex-mw-scroll min-w-0 overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid min-w-[320px] grid-cols-[16px_minmax(72px,max-content)_56px_56px_28px_32px] gap-x-1.5 border-b border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                <span />
                <span>{tw('colSymbol')}</span>
                <span className="text-right">{tw('colBid')}</span>
                <span className="text-right">{tw('colAsk')}</span>
                <span className="text-right">{tw('colSpread')}</span>
                <span className="text-right">{tw('colChange')}</span>
              </div>
              {rows.map((symbol) => {
                const inst = instruments[symbol];
                const q = quotes[symbol];
                const digits = inst?.digits ?? 5;
                const active = selected === symbol;
                const fav = favorites.includes(symbol);
                const label = inst?.displaySymbol ?? symbol;
                const change = describeForexChange({
                  quote: q,
                  reference: changeRefs.references[symbol],
                  referenceStatus: changeRefs.status[symbol],
                });
                return (
                  <button
                    key={symbol}
                    type="button"
                    title={label}
                    onClick={() => focusSymbol(symbol)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/forex-symbol', symbol);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
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
                      'fx-mt5-row grid min-w-[320px] w-full grid-cols-[16px_minmax(72px,max-content)_56px_56px_28px_32px] items-center gap-x-1.5 border-l-2 border-t border-border/50 px-1.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                      active ? 'fx-mt5-row--active border-l-primary' : 'border-l-transparent'
                    )}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={fav ? tw('removeFavorite') : tw('addFavorite')}
                      className={cn('text-[10px]', fav ? 'text-primary' : 'text-muted-foreground/50')}
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
                    <span className="whitespace-nowrap font-mono text-[11px] tabular-nums">{label}</span>
                    <span className="eda-quote text-right font-mono text-[11px] text-buy">
                      {q ? fxNum(q.bid, digits) : '—'}
                    </span>
                    <span className="eda-quote text-right font-mono text-[11px] text-sell">
                      {q ? fxNum(q.ask, digits) : '—'}
                    </span>
                    <span className="text-right font-mono text-[10px] text-muted-foreground">{q?.spreadPips ?? '—'}</span>
                    <span
                      className={cn(
                        'text-right font-mono text-[9px]',
                        change.direction === 'up'
                          ? 'text-buy'
                          : change.direction === 'down'
                            ? 'text-sell'
                            : 'text-muted-foreground'
                      )}
                      title={change.title}
                    >
                      {change.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-[9px] text-muted-foreground">
        {tw('footerSession', { session: footerSession, status: footerStatus, changeNote })}
      </div>
      {menu ? (
        <div
          className="fixed z-50 min-w-[160px] border border-border bg-card py-1 text-[11px] shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <MenuItem
            label={tw('menuFocusChart')}
            onClick={() => {
              focusSymbol(menu.symbol);
              setMenu(null);
            }}
          />
          <MenuItem
            label={tw('menuNewOrder')}
            onClick={() => {
              focusSymbol(menu.symbol);
              setPanel('ticket', true);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
              setMenu(null);
            }}
          />
          <MenuItem
            label={favorites.includes(menu.symbol) ? tw('removeFavorite') : tw('addFavorite')}
            onClick={() => {
              toggleFavorite(menu.symbol);
              setMenu(null);
            }}
          />
          <MenuItem
            label={tw('menuMarketBuyDraft')}
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
              setMenu(null);
            }}
          />
          <MenuItem
            label={tw('menuMarketSellDraft')}
            onClick={() => {
              focusSymbol(menu.symbol);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'sell' });
              setMenu(null);
            }}
          />
          <MenuItem
            label={tw('menuSymbolSpec')}
            onClick={() => {
              setSpecSymbol(menu.symbol);
              setMenu(null);
            }}
          />
          <MenuItem
            label={tw('menuRemoveWatchlist')}
            onClick={() => {
              useForexWorkspaceStore.getState().toggleWatchlistSymbol(menu.symbol);
              setMenu(null);
            }}
          />
          <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" onClick={() => setMenu(null)}>
            {tw('dismiss')}
          </button>
        </div>
      ) : null}
      {specSymbol ? (
        <SymbolSpec symbol={specSymbol} inst={instruments[specSymbol]} sessions={sessions} onClose={() => setSpecSymbol(null)} />
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

function SymbolSpec(props: {
  symbol: string;
  inst: ReturnType<typeof useForexStore.getState>['instruments'][string] | undefined;
  sessions: ReturnType<typeof useForexStore.getState>['sessions'];
  onClose: () => void;
}) {
  const tw = useTranslations('forex.watchlist');
  const i = props.inst;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label={tw('specAria')}>
      <div className="max-h-[80vh] w-full max-w-md overflow-auto border border-border bg-card p-4 text-[12px]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{i?.displaySymbol ?? props.symbol}</h2>
          <button type="button" className="text-muted-foreground" onClick={props.onClose}>
            {tw('close')}
          </button>
        </div>
        {i ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt>{tw('specBaseQuote')}</dt>
            <dd>{i.baseCurrency} / {i.quoteCurrency}</dd>
            <dt>{tw('specContract')}</dt>
            <dd>{i.contractSize}</dd>
            <dt>{tw('specDigitsTick')}</dt>
            <dd>{i.digits} / {i.tickSize}</dd>
            <dt>{tw('specPip')}</dt>
            <dd>{i.pipSize}</dd>
            <dt>{tw('specVolume')}</dt>
            <dd>{i.minVolume}–{i.maxVolume} step {i.volumeStep}</dd>
            <dt>{tw('specLeverageMargin')}</dt>
            <dd>{i.maxLeverage} / {i.marginPercent}</dd>
            <dt>{tw('specCommission')}</dt>
            <dd>{i.commission} {i.commissionType}</dd>
            <dt>{tw('specSwap')}</dt>
            <dd>{i.swapLong} / {i.swapShort} / {i.swap3day}</dd>
            <dt>{tw('specStatus')}</dt>
            <dd>{i.tradingStatus}</dd>
            <dt>{tw('specSession')}</dt>
            <dd>{props.sessions?.eligibility.open ? tw('specSessionOpen') : props.sessions?.eligibility.reason ?? '—'}</dd>
            <dt>{tw('specExecution')}</dt>
            <dd>{tw('specSimulated')}</dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">{tw('specUnavailable', { symbol: props.symbol })}</p>
        )}
      </div>
    </div>
  );
}
