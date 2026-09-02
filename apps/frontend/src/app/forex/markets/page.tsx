'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { fxNum, fxPlain } from '@/components/forex/format';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import type { ForexAssetClass } from '@/lib/forex/models/types';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

type Filter = 'all' | ForexAssetClass;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'fx_major', label: 'Majors' },
  { id: 'fx_cross', label: 'Crosses' },
  { id: 'metal', label: 'Metals' },
];

function metalsNote(symbol: string): string | undefined {
  if (symbol === 'XAUUSD') return 'COMEX gold futures proxy';
  if (symbol === 'XAGUSD') return 'COMEX silver futures proxy';
  return undefined;
}

export default function ForexMarketsPage() {
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const rows = useMemo(() => {
    return Object.values(instruments)
      .filter((inst) => (filter === 'all' ? true : inst.assetClass === filter))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [instruments, filter]);

  return (
    <ForexPageFrame
      wide
      title="Markets"
      subtitle="Live Bid, Ask and spread from EDA Forex quotes. Change is not shown unless the quote feed provides it."
    >
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Instrument class">
        {FILTERS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={cn('eda-tab', filter === t.id && 'eda-tab-active')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{Object.keys(instruments).length ? 'No instruments for this filter.' : 'Loading market data…'}</p>
      ) : (
        <div className="eda-table-wrap">
          <table className="eda-table min-w-[860px] font-mono text-[12px]">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Spread</th>
                <th>Status</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inst) => {
                const q = quotes[inst.symbol];
                const stale = !q || isQuoteStale(q);
                const note = metalsNote(inst.symbol);
                return (
                  <tr key={inst.symbol}>
                    <td>
                      <button
                        type="button"
                        className="text-left text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          setSelected(inst.symbol);
                          router.push(FOREX_ROUTES.trade);
                        }}
                      >
                        {inst.displaySymbol ?? inst.symbol}
                      </button>
                      {note ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{note}</span> : null}
                    </td>
                    <td className="eda-quote text-buy">{q ? fxNum(q.bid, inst.digits) : 'Unavailable'}</td>
                    <td className="eda-quote text-sell">{q ? fxNum(q.ask, inst.digits) : 'Unavailable'}</td>
                    <td>{q ? fxPlain(q.spreadPips) : 'Unavailable'}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', !stale ? 'bg-buy' : 'bg-muted-foreground')} aria-hidden />
                        {!q ? 'Unavailable' : stale ? 'Stale' : 'Live'}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{sessions?.eligibility.open ? 'Open' : sessions?.eligibility.reason ?? 'Unavailable'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ForexPageFrame>
  );
}
