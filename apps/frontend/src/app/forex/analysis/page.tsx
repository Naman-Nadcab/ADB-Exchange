'use client';

import { useEffect, useMemo, useState } from 'react';
import { ForexChartFoundation } from '@/components/forex/ForexChartFoundation';
import { latestIndicators } from '@/lib/forex/analysis/indicators';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

type NewsItem = { time?: string | null; headline?: string; source?: string; url?: string | null };
type CalendarEvent = {
  time?: string | null;
  currency?: string | null;
  event?: string;
  impact?: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
};

export default function ForexAnalysisPage() {
  const symbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const tf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const candles = useForexCandles(symbol, tf || '1D');
  const indicators = useMemo(
    () => (candles.status === 'READY' ? latestIndicators(candles.candles) : null),
    [candles]
  );
  const [news, setNews] = useState<{ availability: string; reason?: string; provider?: string; items: NewsItem[] } | null>(null);
  const [calendar, setCalendar] = useState<{
    availability: string;
    reason?: string;
    provider?: string;
    events: CalendarEvent[];
  } | null>(null);
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');

  useEffect(() => {
    void forexApi.news().then((res) => {
      const u = unwrap(res);
      if (u.ok)
        setNews({
          availability: u.data.availability,
          reason: u.data.reason,
          provider: u.data.provider,
          items: (u.data.items as NewsItem[]) ?? [],
        });
    });
    void forexApi.calendar().then((res) => {
      const u = unwrap(res);
      if (u.ok)
        setCalendar({
          availability: u.data.availability,
          reason: u.data.reason,
          provider: u.data.provider,
          events: (u.data.events as CalendarEvent[]) ?? [],
        });
    });
  }, []);

  const currencies = useMemo(() => {
    const set = new Set((calendar?.events ?? []).map((e) => e.currency).filter((c): c is string => Boolean(c)));
    return ['ALL', ...[...set].sort()];
  }, [calendar]);

  const calendarRows = useMemo(() => {
    return (calendar?.events ?? []).filter((ev) => {
      const impact = (ev.impact ?? '').toLowerCase();
      if (impactFilter !== 'ALL') {
        if (impactFilter === 'Low' && impact !== 'low' && impact !== 'holiday') return false;
        if (impactFilter !== 'Low' && impact !== impactFilter.toLowerCase()) return false;
      }
      if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) return false;
      return true;
    });
  }, [calendar, impactFilter, currencyFilter]);

  const fmt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? 'Unavailable' : n.toFixed(5));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Analysis</h1>
      <p className="text-[12px] text-stone-500">
        Chart uses GET /candles. Indicators are local analysis only and never affect execution, margin, or the ledger.
      </p>
      <div className="h-[360px] overflow-hidden rounded border border-stone-200 dark:border-stone-800">
        <ForexChartFoundation />
      </div>

      <section className="rounded border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#101214]">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Indicators · analysis only</h2>
        {candles.status !== 'READY' ? (
          <p className="mt-2 text-[13px] text-stone-500">Historical market data unavailable.</p>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-[12px] md:grid-cols-4">
            <div>
              <dt className="text-stone-400">SMA 20</dt>
              <dd>{fmt(indicators?.sma20)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">EMA 20</dt>
              <dd>{fmt(indicators?.ema20)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">RSI 14</dt>
              <dd>{fmt(indicators?.rsi14)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">MACD</dt>
              <dd>{fmt(indicators?.macd)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Bollinger mid</dt>
              <dd>{fmt(indicators?.bollinger?.mid)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">ATR 14</dt>
              <dd>{fmt(indicators?.atr14)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Stochastic 14</dt>
              <dd>{fmt(indicators?.stoch14)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#101214]">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Economic calendar</h2>
        {calendar?.availability === 'UNAVAILABLE' || !calendar ? (
          <p className="mt-2 text-[13px] text-stone-500">
            Economic calendar unavailable{calendar?.reason ? ` (${calendar.reason})` : ''}.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[11px] text-stone-500">
              Source {calendar.provider ?? 'external'} · this-week feed. Actual is shown only when the provider supplies it.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
              {(['ALL', 'High', 'Medium', 'Low'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={impactFilter === level}
                  onClick={() => setImpactFilter(level)}
                  className={`rounded border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                    impactFilter === level ? 'border-stone-800 dark:border-stone-200' : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  {level}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1">
                <span className="text-stone-500">Currency</span>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="h-7 rounded border border-stone-300 bg-transparent px-1 dark:border-stone-700"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {calendarRows.length === 0 ? (
              <p className="mt-2 text-[13px] text-stone-500">No calendar events for this filter.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-[720px] w-full text-left font-mono text-[12px]">
                  <thead className="text-stone-500">
                    <tr>
                      <th className="py-1 font-medium">Time</th>
                      <th className="py-1 font-medium">Currency</th>
                      <th className="py-1 font-medium">Event</th>
                      <th className="py-1 font-medium">Impact</th>
                      <th className="py-1 font-medium">Actual</th>
                      <th className="py-1 font-medium">Forecast</th>
                      <th className="py-1 font-medium">Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarRows.slice(0, 80).map((ev, i) => (
                      <tr key={`${ev.event}-${ev.time}-${i}`} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="py-1">{ev.time ? new Date(ev.time).toLocaleString() : '—'}</td>
                        <td className="py-1">{ev.currency ?? '—'}</td>
                        <td className="py-1">{ev.event}</td>
                        <td className="py-1">{ev.impact ?? '—'}</td>
                        <td className="py-1">{ev.actual ?? 'Unavailable'}</td>
                        <td className="py-1">{ev.forecast ?? '—'}</td>
                        <td className="py-1">{ev.previous ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#101214]">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
          News{news?.provider ? ` · ${news.provider}` : ''}
        </h2>
        {!news || news.availability === 'UNAVAILABLE' ? (
          <p className="mt-2 text-[13px] text-stone-500">No market news available{news?.reason ? ` (${news.reason})` : ''}.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {news.items.slice(0, 20).map((item, i) => (
              <li key={`${item.headline}-${i}`} className="text-[13px]">
                <span className="font-mono text-[11px] text-stone-400">{item.time ? new Date(item.time).toLocaleString() : ''}</span>{' '}
                {item.url ? (
                  <a href={item.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
                <span className="text-stone-400"> · {item.source}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
