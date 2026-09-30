'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Star, Search } from 'lucide-react';
import { formatValueFixedTrim, formatCompactNumber } from '@/components/trade/terminalFormat';
import { formatMoverChangePct, moverChangeTone } from '@/components/trade/terminalUiFormat';
import { TerminalEmptyState } from '@/components/trade/TerminalEmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useDisplayCurrency } from '@/context/DisplayCurrencyProvider';

export type MarketRow = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  last_price?: string | null;
  change_24h?: number | null;
  volume_24h?: string | null;
  base_volume_24h?: string | null;
  /** Exchange instrument price decimals — tier-1 list display per pair */
  price_precision?: number;
};

type TabId = 'favorites' | 'usdt' | 'btc';
type ScanMode = 'all' | 'top_volume' | 'gainers' | 'losers';

interface MarketsSidebarProps {
  markets: MarketRow[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  loading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Optional: user's favorite symbols (e.g. from localStorage) */
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
  /**
   * `terminal` — spot right-rail: Binance-like density, no outer border, sticky column header in list scroll.
   */
  variant?: 'default' | 'terminal';
}

export function MarketsSidebar({
  markets,
  selectedSymbol,
  onSelectSymbol,
  loading = false,
  errorMessage,
  onRetry,
  favorites = [],
  onToggleFavorite,
  variant = 'default',
}: MarketsSidebarProps) {
  const { displayCurrency, formatFromUsdt } = useDisplayCurrency();
  const [tab, setTab] = useState<TabId>('usdt');
  const [search, setSearch] = useState('');
  const [kbdIndex, setKbdIndex] = useState(0);
  const [scanMode, setScanMode] = useState<ScanMode>('all');
  const [sortBy, setSortBy] = useState<'pair' | 'last' | 'change'>('pair');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    let list = markets;
    if (tab === 'usdt') list = list.filter((m) => m.quote_asset === 'USDT');
    else if (tab === 'btc') list = list.filter((m) => m.quote_asset === 'BTC');
    else if (tab === 'favorites') list = list.filter((m) => favorites.includes(m.symbol));
    if (search.trim()) {
      const q = search.toUpperCase().replace(/\//g, '_');
      list = list.filter((m) => m.symbol.toUpperCase().includes(q) || m.base_asset.toUpperCase().includes(q));
    }
    if (scanMode === 'top_volume') {
      list = [...list].sort((a, b) => (Number(b.volume_24h ?? 0) || 0) - (Number(a.volume_24h ?? 0) || 0));
    } else if (scanMode === 'gainers') {
      list = [...list].sort((a, b) => (Number(b.change_24h ?? -Infinity) || -Infinity) - (Number(a.change_24h ?? -Infinity) || -Infinity));
    } else if (scanMode === 'losers') {
      list = [...list].sort((a, b) => (Number(a.change_24h ?? Infinity) || Infinity) - (Number(b.change_24h ?? Infinity) || Infinity));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortBy === 'last') {
        return ((Number(a.last_price ?? 0) || 0) - (Number(b.last_price ?? 0) || 0)) * dir;
      }
      if (sortBy === 'change') {
        return ((Number(a.change_24h ?? 0) || 0) - (Number(b.change_24h ?? 0) || 0)) * dir;
      }
      const aPair = `${a.base_asset}/${a.quote_asset}`;
      const bPair = `${b.base_asset}/${b.quote_asset}`;
      return aPair.localeCompare(bPair) * dir;
    });
    return list;
  }, [markets, tab, search, favorites, scanMode, sortBy, sortDir]);

  useEffect(() => {
    const selectedIdx = filtered.findIndex((m) => m.symbol === selectedSymbol);
    if (selectedIdx >= 0) setKbdIndex(selectedIdx);
    else setKbdIndex(0);
  }, [filtered, selectedSymbol]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'favorites', label: 'Favorites' },
    { id: 'usdt', label: 'USDT' },
    { id: 'btc', label: 'BTC' },
  ];
  const toggleSort = (next: 'pair' | 'last' | 'change') => {
    if (sortBy === next) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(next);
      setSortDir(next === 'pair' ? 'asc' : 'desc');
    }
  };
  const sortGlyph = (next: 'pair' | 'last' | 'change') =>
    sortBy === next ? (
      <span className="ml-0.5 inline-block text-[10px] leading-none">{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  const isTerminal = variant === 'terminal';

  return (
    <div
      className={
          isTerminal
            ? 'exchange-ui flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card antialiased'
          : 'exchange-ui flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-card'
      }
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '/') {
          e.preventDefault();
          searchInputRef.current?.focus();
          return;
        }
        if (filtered.length === 0) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = Math.min(filtered.length - 1, kbdIndex + 1);
          setKbdIndex(next);
          onSelectSymbol(filtered[next]!.symbol);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const next = Math.max(0, kbdIndex - 1);
          setKbdIndex(next);
          onSelectSymbol(filtered[next]!.symbol);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const row = filtered[kbdIndex];
          if (row) onSelectSymbol(row.symbol);
        }
      }}
    >
      {/* Tabs + search: fixed to top of section; list scrolls independently below (Binance-style). */}
      <div
        className={
          isTerminal
            ? 'sticky top-0 z-20 shrink-0 border-b border-border bg-card'
            : 'shrink-0 border-b border-border'
        }
      >
        <div className={isTerminal ? 'flex px-0.5' : 'flex'}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                isTerminal
                  ? `flex-1 py-1.5 text-label font-semibold leading-none transition-colors ${
                      tab === t.id
                        ? 'border-b-2 border-primary text-foreground'
                        : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
                    }`
                  : `flex-1 py-2.5 text-small font-medium transition-colors ${
                      tab === t.id ? 'border-b-2 border-buy text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={isTerminal ? 'border-t border-border/80 px-2 py-1' : 'border-b border-border p-2'}>
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isTerminal ? 'left-2 h-3 w-3' : 'left-2.5 h-4 w-4'}`}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={
                isTerminal
                  ? 'h-7 w-full rounded-md border border-border bg-muted/40 pl-7 pr-2 text-label leading-none text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:bg-muted/55 focus:outline-none focus:ring-0'
                  : 'h-8 w-full rounded border border-border bg-background pl-8 pr-3 text-foreground text-small placeholder:text-muted-foreground/60 focus:border-border focus:outline-none focus:ring-1 focus:ring-buy/25'
              }
            />
          </div>
        </div>
      </div>
      {isTerminal && (
        <div className="flex items-center gap-0.5 border-t border-border/80 bg-card px-1.5 py-1">
          {(
            [
              ['all', 'All'],
              ['top_volume', 'Top Ref. Vol'],
              ['gainers', 'Gainers'],
              ['losers', 'Losers'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScanMode(id)}
              className={`rounded px-1.5 py-0.5 text-label font-semibold uppercase leading-none ${
                scanMode === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className={
          isTerminal
            ? 'spot-rail-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5'
            : 'min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]'
        }
      >
        <table
          className={
            isTerminal
              ? 'w-full table-fixed border-separate border-spacing-0 terminal-text-table text-foreground'
              : 'w-full text-small'
          }
        >
          {isTerminal ? (
            <colgroup>
              <col className="w-[44%]" />
              <col className="w-[33%]" />
              <col className="w-[23%]" />
            </colgroup>
          ) : null}
          <thead
            className={
              isTerminal
                ? 'sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm'
                : 'sticky top-0 z-10 bg-card'
            }
          >
            <tr
              className={
                isTerminal
                  ? 'text-label font-semibold uppercase leading-none text-muted-foreground'
                  : 'font-medium text-muted-foreground'
              }
            >
              <th className={`text-left ${isTerminal ? 'px-2 py-1.5' : 'px-2 py-2'}`}>
                <button type="button" className="inline-flex items-center gap-0.5" onClick={() => toggleSort('pair')}>
                  <span>Pair</span>
                  {sortGlyph('pair')}
                </button>
              </th>
              <th className={`text-right whitespace-nowrap ${isTerminal ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}>
                <button type="button" className="inline-flex w-full items-center justify-end gap-0.5" onClick={() => toggleSort('last')}>
                  <span>Last</span>
                  {sortGlyph('last')}
                </button>
              </th>
              <th
                className={`text-right whitespace-nowrap ${isTerminal ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}
                title="24 hour change"
              >
                <button type="button" className="inline-flex w-full items-center justify-end gap-0.5" onClick={() => toggleSort('change')}>
                  <span>{isTerminal ? 'Chg' : '24h%'}</span>
                  {sortGlyph('change')}
                </button>
              </th>
              {!isTerminal && (
                <th className="px-2 py-2 text-right whitespace-nowrap" title="Reference market volume from external OHLCV when no exchange trades">
                  Ref. Vol
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border/80">
                  <td className={isTerminal ? 'px-3 py-2' : 'px-2 py-1.5'}>
                    <Skeleton className="h-4 w-20 bg-accent" />
                  </td>
                  <td className={`${isTerminal ? 'px-1 py-2 pr-2' : 'px-2 py-1.5'} text-right`}>
                    <Skeleton className="ml-auto h-4 w-14 bg-accent" />
                  </td>
                  <td className={`${isTerminal ? 'px-1 py-2' : 'px-2 py-1.5'} text-right`}>
                    <Skeleton className="ml-auto h-4 w-10 bg-accent" />
                  </td>
                  {!isTerminal && (
                    <td className="px-2 py-1.5 text-right">
                      <Skeleton className="ml-auto h-4 w-12 bg-accent" />
                    </td>
                  )}
                </tr>
              ))
            ) : errorMessage ? (
              <tr>
                <td colSpan={isTerminal ? 3 : 4} className="px-3 py-6 text-center">
                  <p className="mb-3 text-sm text-sell">{errorMessage}</p>
                  {onRetry ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="min-h-[44px] rounded-lg bg-buy/90 px-4 py-2 text-sm font-medium tracking-wide text-neutral-950 hover:bg-buy active:scale-[0.99]"
                    >
                      Retry
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isTerminal ? 3 : 4}
                  className={
                    isTerminal
                      ? 'px-3 py-6'
                      : 'px-3 py-8 text-center text-sm text-muted-foreground'
                  }
                >
                  {isTerminal ? (
                    <TerminalEmptyState
                      kind="markets"
                      title="No markets match"
                      description="Try a different search or filter."
                      compact
                    />
                  ) : (
                    'No markets match your filters.'
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((m, idx) => {
                const isSelected = m.symbol === selectedSymbol;
                const change = m.change_24h;
                const rowBorder = 'border-b border-border/80';
                const rowHover = isTerminal ? 'hover:bg-muted/45' : 'hover:bg-muted/30';
                const cellY = isTerminal ? 'py-1' : 'py-2';
                const pxPair = isTerminal ? 'px-2' : 'px-2';
                const pxMid = isTerminal ? 'px-1 pr-1.5' : 'px-2';
                const starHover = 'hover:text-primary';
                const listPricePrecision = Math.min(6, Math.max(2, Math.floor(m.price_precision ?? 6)));
                const changeToneClass =
                  moverChangeTone(change) === 'buy'
                    ? 'text-buy'
                    : moverChangeTone(change) === 'sell'
                      ? 'text-sell'
                      : 'text-muted-foreground';
                return (
                  <tr
                    key={m.symbol}
                    className={`cursor-pointer border-l-2 transition-colors duration-150 ${rowBorder} ${rowHover} ${
                      isSelected
                        ? isTerminal
                          ? 'border-l-primary bg-muted/55 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]'
                          : 'border-l-transparent bg-buy/10'
                        : 'border-l-transparent'
                    }`}
                    onClick={() => onSelectSymbol(m.symbol)}
                    onMouseEnter={() => setKbdIndex(idx)}
                  >
                    <td className={`min-w-0 ${pxPair} ${cellY}`}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(m.symbol);
                            }}
                            className={`shrink-0 rounded p-0.5 text-muted-foreground transition-colors ${starHover}`}
                            aria-label={favorites.includes(m.symbol) ? 'Remove favorite' : 'Add favorite'}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${favorites.includes(m.symbol) ? 'fill-primary text-primary' : ''}`}
                            />
                          </button>
                        )}
                        <CoinIcon symbol={m.base_asset} size={16} className="shrink-0" />
                        <span
                          className="min-w-0 truncate terminal-text-table font-semibold tracking-tight text-foreground"
                          title={`${m.base_asset}/${m.quote_asset}`}
                        >
                          {m.base_asset}
                          <span className="font-medium text-muted-foreground">/{m.quote_asset}</span>
                        </span>
                      </div>
                    </td>
                    <td
                      className={`numeric whitespace-nowrap text-right font-medium ${cellY} ${pxMid} text-foreground ${isTerminal ? 'text-price' : 'text-label'}`}
                    >
                      {m.last_price != null ? (
                        <>
                          <span>{formatValueFixedTrim(m.last_price, listPricePrecision)}</span>
                          {m.quote_asset === 'USDT' ? (
                            <span className="ml-0.5 text-label font-medium text-muted-foreground">USDT</span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                      {m.last_price != null && m.quote_asset === 'USDT' && displayCurrency === 'INR' ? (
                        <div className="text-label font-medium text-muted-foreground">
                          {formatFromUsdt(Number(m.last_price), listPricePrecision)}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={`numeric whitespace-nowrap text-right font-semibold ${cellY} ${isTerminal ? 'px-1 text-price' : 'px-2 text-label'} ${changeToneClass}`}
                    >
                      {formatMoverChangePct(change)}
                    </td>
                    {!isTerminal && (
                      <td className="numeric whitespace-nowrap py-1.5 px-2 text-right font-medium text-label text-muted-foreground">
                        {m.volume_24h != null ? formatCompactNumber(m.volume_24h) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
