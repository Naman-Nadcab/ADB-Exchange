'use client';

import { useEffect, useMemo, useState } from 'react';
import { ForexChartFoundation } from '@/components/forex/ForexChartFoundation';
import { latestIndicators } from '@/lib/forex/analysis/indicators';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

type NewsItem = { time?: string | null; headline?: string; source?: string; url?: string | null };

export default function ForexAnalysisPage() {
  const symbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const tf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const candles = useForexCandles(symbol, tf || '1D');
  const indicators = useMemo(
    () => (candles.status === 'READY' ? latestIndicators(candles.candles) : null),
    [candles]
  );
  const [news, setNews] = useState<{ availability: string; reason?: string; items: NewsItem[] } | null>(null);
  const [calendar, setCalendar] = useState<{ availability: string; reason?: string } | null>(null);

  useEffect(() => {
    void forexApi.news().then((res) => {
      const u = unwrap(res);
      if (u.ok) setNews({ availability: u.data.availability, reason: u.data.reason, items: (u.data.items as NewsItem[]) ?? [] });
    });
    void forexApi.calendar().then((res) => {
      const u = unwrap(res);
      if (u.ok) setCalendar({ availability: u.data.availability, reason: u.data.reason });
    });
  }, []);

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
        <p className="mt-2 text-[13px] text-stone-500">
          {calendar?.availability === 'UNAVAILABLE' || !calendar
            ? `Economic calendar unavailable${calendar?.reason ? ` (${calendar.reason})` : ''}.`
            : 'Calendar loaded.'}
        </p>
      </section>

      <section className="rounded border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#101214]">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-stone-500">News</h2>
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
