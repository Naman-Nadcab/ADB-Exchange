'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { fxNum, fxPlain } from '@/components/forex/format';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import type { ForexAssetClass } from '@/lib/forex/models/types';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

type Filter = 'all' | ForexAssetClass | 'watchlist';

const FILTERS: Array<{ id: Filter; labelKey: string }> = [
  { id: 'all', labelKey: 'markets.filters.all' },
  { id: 'fx_major', labelKey: 'markets.filters.majors' },
  { id: 'fx_cross', labelKey: 'markets.filters.crosses' },
  { id: 'metal', labelKey: 'markets.filters.metals' },
  { id: 'watchlist', labelKey: 'markets.filters.watchlist' },
];

function metalsNote(symbol: string): string | undefined {
  if (symbol === 'XAUUSD') return 'COMEX gold futures proxy';
  if (symbol === 'XAGUSD') return 'COMEX silver futures proxy';
  return undefined;
}

export default function ForexMarketsPage() {
  const tf = useTranslations('forex');
  const classLabel = (assetClass: ForexAssetClass): string => {
    if (assetClass === 'fx_major') return tf('markets.classLabels.major');
    if (assetClass === 'fx_cross') return tf('markets.classLabels.cross');
    return tf('markets.classLabels.metal');
  };
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const watchlist = useForexWorkspaceStore((s) => s.watchlist);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const toggleWatch = useForexWorkspaceStore((s) => s.toggleWatchlistSymbol);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'symbol' | 'spread'>('symbol');

  const sessionOpen = sessions?.eligibility.open === true;
  const sessionReason = sessions?.eligibility.reason ?? tf('markets.sessionUnavailable');

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const list = Object.values(instruments).filter((inst) => {
      if (filter === 'watchlist') return watchlist.includes(inst.symbol);
      if (filter !== 'all' && inst.assetClass !== filter) return false;
      if (!q) return true;
      return (
        inst.symbol.includes(q) ||
        (inst.displaySymbol ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').includes(q) ||
        inst.baseCurrency?.toUpperCase().includes(q) ||
        inst.quoteCurrency?.toUpperCase().includes(q)
      );
    });
    list.sort((a, b) => {
      if (sort === 'spread') {
        const sa = Number(quotes[a.symbol]?.spreadPips);
        const sb = Number(quotes[b.symbol]?.spreadPips);
        const fa = Number.isFinite(sa) ? sa : Number.POSITIVE_INFINITY;
        const fb = Number.isFinite(sb) ? sb : Number.POSITIVE_INFINITY;
        if (fa !== fb) return fa - fb;
      }
      return a.symbol.localeCompare(b.symbol);
    });
    return list;
  }, [instruments, filter, query, sort, watchlist, quotes]);

  const liveCount = useMemo(
    () => rows.filter((inst) => quotes[inst.symbol] && !isQuoteStale(quotes[inst.symbol]!)).length,
    [rows, quotes]
  );

  const openTrade = (symbol: string) => {
    setSelected(symbol);
    router.push(`${FOREX_ROUTES.trade}?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <ForexPageFrame
      wide
      title={tf('pages.markets.title')}
      subtitle={tf('pages.markets.subtitle')}
      actions={
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium',
              sessionOpen ? 'border-buy/30 bg-buy/10 text-buy' : 'border-sell/30 bg-sell/10 text-sell'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', sessionOpen ? 'bg-buy' : 'bg-sell')} aria-hidden />
            Session {sessionOpen ? 'Open' : 'Closed'}
          </span>
          <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
            {liveCount}/{rows.length} live
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Instrument class">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn('eda-tab', filter === f.id && 'eda-tab-active')}
            >
              {tf(f.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="fx-markets-search">
            Search symbols
          </label>
          <input
            id="fx-markets-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search EUR, XAU…"
            className="h-9 w-full min-w-[180px] rounded-lg border border-border bg-card px-3 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'symbol' | 'spread')}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[12px] text-foreground"
            aria-label="Sort markets"
          >
            <option value="symbol">Sort · Symbol</option>
            <option value="spread">Sort · Spread</option>
          </select>
        </div>
      </div>

      {!sessionOpen ? (
        <p className="text-[12px] text-amber-400">Market session: {sessionReason}. Quotes may still stream in demo mode.</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="eda-card p-6 text-sm text-muted-foreground">
          {Object.keys(instruments).length
            ? filter === 'watchlist'
              ? 'Watchlist is empty. Star a market card to add it.'
              : 'No instruments for this filter.'
            : 'Loading market data…'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((inst) => {
            const q = quotes[inst.symbol];
            const stale = !q || isQuoteStale(q);
            const note = metalsNote(inst.symbol);
            const starred = watchlist.includes(inst.symbol);
            const mid =
              q && Number.isFinite(Number(q.bid)) && Number.isFinite(Number(q.ask))
                ? (Number(q.bid) + Number(q.ask)) / 2
                : null;
            return (
              <article
                key={inst.symbol}
                className="eda-card-interactive group flex flex-col p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openTrade(inst.symbol)}
                  >
                    <h2 className="truncate font-mono text-[14px] font-semibold tabular-nums tracking-tight text-foreground">
                      {inst.displaySymbol ?? inst.symbol}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {classLabel(inst.assetClass)} · {inst.digits} digits
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                    aria-pressed={starred}
                    onClick={() => toggleWatch(inst.symbol)}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[16px] leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      starred ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    ★
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-buy/20 bg-buy/5 px-2.5 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Bid</dt>
                    <dd className="eda-quote mt-0.5 font-mono text-[15px] font-semibold text-buy">
                      {q ? fxNum(q.bid, inst.digits) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-sell/20 bg-sell/5 px-2.5 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Ask</dt>
                    <dd className="eda-quote mt-0.5 font-mono text-[15px] font-semibold text-sell">
                      {q ? fxNum(q.ask, inst.digits) : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                  <span>
                    Spread <span className="text-foreground">{q ? fxPlain(q.spreadPips) : '—'}</span>
                  </span>
                  {mid != null ? (
                    <span>
                      Mid <span className="text-foreground">{fxNum(mid, inst.digits)}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', !stale ? 'bg-buy' : 'bg-muted-foreground')} aria-hidden />
                    <span className={!q ? 'text-muted-foreground' : stale ? 'text-amber-400' : 'text-buy'}>
                      {!q ? 'Unavailable' : stale ? 'Stale' : 'Live'}
                    </span>
                  </span>
                </div>

                {note ? <p className="mt-2 text-[10px] text-amber-400/90">{note}</p> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!sessionOpen ? (
                    <span className="text-[11px] font-medium uppercase tracking-wide text-amber-400/95">
                      Session closed
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openTrade(inst.symbol)}
                    className="ml-auto inline-flex h-7 items-center justify-center border border-border bg-[#1a1f26] px-2.5 text-[11px] font-medium text-foreground hover:border-primary/35 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Trade
                  </button>
                  <Link
                    href={`${FOREX_ROUTES.analysis}?symbol=${encodeURIComponent(inst.symbol)}`}
                    onClick={() => setSelected(inst.symbol)}
                    className="inline-flex h-7 items-center justify-center border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    Analyze
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ForexPageFrame>
  );
}
