'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ForexChartFoundation } from '@/components/forex/ForexChartFoundation';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { fxNum } from '@/components/forex/format';
import { latestIndicators } from '@/lib/forex/analysis/indicators';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { deriveStructureLevels } from '@/lib/forex/chart/structure-levels';
import { isLondonNyOverlapUtc } from '@/lib/forex/chart/session-markers';
import { pipSizeFromInstrument, priceDistancePips } from '@/lib/forex/chart/pip-math';
import { ema as emaSeries } from '@/lib/forex/chart/studies';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

type NewsItem = {
  time?: string | null;
  headline?: string;
  source?: string;
  url?: string | null;
  currency?: string | null;
};
type CalendarEvent = {
  time?: string | null;
  currency?: string | null;
  event?: string;
  impact?: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
};

type MtfBias = {
  tf: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral' | 'n/a';
  detail: string;
};

const QUICK_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'XAUUSD', 'EURGBP', 'GBPJPY', 'XAGUSD'];
const MTF_TFS = ['5m', '15m', '1h', '4h', '1D'] as const;

function impactTone(impact: string | undefined): string {
  const i = String(impact ?? '').toLowerCase();
  if (i.includes('high')) return 'border-sell/40 bg-sell/15 text-sell';
  if (i.includes('medium')) return 'border-amber-500/40 bg-amber-500/15 text-amber-400';
  return 'border-border bg-muted text-muted-foreground';
}

function rsiTone(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-muted-foreground';
  if (v >= 70) return 'text-sell';
  if (v <= 30) return 'text-buy';
  return 'text-foreground';
}

export default function ForexAnalysisPage() {
  const symbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const setSymbol = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const tf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const inst = useForexStore((s) => s.instruments[symbol]);
  const quote = useForexStore((s) => s.quotes[symbol]);
  const sessions = useForexStore((s) => s.sessions);
  const candles = useForexCandles(symbol, tf || '15m');
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
  const [mtf, setMtf] = useState<MtfBias[]>([]);
  const [intelTab, setIntelTab] = useState<'calendar' | 'news' | 'levels' | 'sessions'>('calendar');

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('symbol');
      if (fromUrl) setSymbol(fromUrl);
    } catch {
      /* ignore */
    }
  }, [setSymbol]);

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

  // Multi-timeframe EMA20 vs EMA50 — deterministic derived analysis only.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results: MtfBias[] = [];
      for (const timeframe of MTF_TFS) {
        const res = await forexApi.candles({ symbol, timeframe, limit: 120 });
        const u = unwrap(res);
        if (!u.ok || u.data.availability !== 'AVAILABLE' || !u.data.candles?.length) {
          results.push({ tf: timeframe, bias: 'n/a', detail: 'No history' });
          continue;
        }
        const bars = u.data.candles
          .map((c) => {
            const ms = candleTimeMs(c.timestamp);
            if (ms == null) return null;
            const open = Number(c.open);
            const high = Number(c.high);
            const low = Number(c.low);
            const close = Number(c.close);
            if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) return null;
            return { time: Math.floor(ms / 1000), open, high, low, close };
          })
          .filter((b): b is NonNullable<typeof b> => b != null);
        const e20 = emaSeries(bars, 20);
        const e50 = emaSeries(bars, 50);
        const a = e20[e20.length - 1]?.value;
        const b = e50[e50.length - 1]?.value;
        if (a == null || b == null) {
          results.push({ tf: timeframe, bias: 'n/a', detail: 'Insufficient bars' });
        } else if (a > b) {
          results.push({ tf: timeframe, bias: 'Bullish', detail: `EMA20 ${a.toFixed(5)} > EMA50 ${b.toFixed(5)}` });
        } else if (a < b) {
          results.push({ tf: timeframe, bias: 'Bearish', detail: `EMA20 ${a.toFixed(5)} < EMA50 ${b.toFixed(5)}` });
        } else {
          results.push({ tf: timeframe, bias: 'Neutral', detail: 'EMA20 = EMA50' });
        }
      }
      if (!cancelled) setMtf(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const currencies = useMemo(() => {
    const set = new Set((calendar?.events ?? []).map((e) => e.currency).filter((c): c is string => Boolean(c)));
    return ['ALL', ...Array.from(set).sort()];
  }, [calendar]);

  const calendarRows = useMemo(() => {
    const now = Date.now();
    return (calendar?.events ?? [])
      .filter((ev) => {
        const impact = (ev.impact ?? '').toLowerCase();
        if (impactFilter !== 'ALL') {
          if (impactFilter === 'Low' && impact !== 'low' && impact !== 'holiday') return false;
          if (impactFilter !== 'Low' && impact !== impactFilter.toLowerCase()) return false;
        }
        if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = a.time ? Date.parse(a.time) : 0;
        const tb = b.time ? Date.parse(b.time) : 0;
        // Upcoming first, then recent
        const ua = ta >= now - 60_000 ? 0 : 1;
        const ub = tb >= now - 60_000 ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return ta - tb;
      });
  }, [calendar, impactFilter, currencyFilter]);

  const levels = useMemo(
    () => (candles.status === 'READY' ? deriveStructureLevels(candles.candles) : []),
    [candles]
  );

  const digits = inst?.digits ?? 5;
  const pipSize = pipSizeFromInstrument({ pipSize: inst?.pipSize, digits });

  const volatility = useMemo(() => {
    if (candles.status !== 'READY' || !candles.candles.length) return null;
    const bars = candles.candles
      .map((c) => {
        const ms = candleTimeMs(c.timestamp);
        if (ms == null) return null;
        return {
          t: ms,
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        };
      })
      .filter((b): b is NonNullable<typeof b> => b != null && Number.isFinite(b.high) && Number.isFinite(b.low));
    if (!bars.length) return null;
    const last = bars[bars.length - 1]!;
    const dayKey = `${new Date(last.t).getUTCFullYear()}-${new Date(last.t).getUTCMonth()}-${new Date(last.t).getUTCDate()}`;
    const today = bars.filter((b) => {
      const d = new Date(b.t);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}` === dayKey;
    });
    const dayHi = Math.max(...today.map((b) => b.high));
    const dayLo = Math.min(...today.map((b) => b.low));
    const dayRange = priceDistancePips(dayHi, dayLo, pipSize);
    const atrPips = indicators?.atr14 != null && pipSize > 0 ? indicators.atr14 / pipSize : null;
    return { dayRange, atrPips, dayHi, dayLo, barCount: candles.candles.length };
  }, [candles, pipSize, indicators]);

  const fmt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(Math.min(digits, 5)));
  const hour = new Date().getUTCHours();
  const overlap = isLondonNyOverlapUtc(hour);
  const sessionOpen = sessions?.eligibility.open === true;

  const symbolCcys = useMemo(() => {
    const base = symbol.slice(0, 3);
    const quoteCcy = symbol.slice(3, 6);
    return [base, quoteCcy];
  }, [symbol]);

  return (
    <ForexPageFrame
      wide
      title="Analysis"
      subtitle="Tier-0 market intelligence workspace. Chart tools, derived studies, calendar and news — never used for execution, margin or ledger."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={FOREX_ROUTES.trade}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Trade {inst?.displaySymbol ?? symbol}
          </Link>
          <Link
            href={FOREX_ROUTES.markets}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12px] font-semibold hover:border-primary/40"
          >
            Markets
          </Link>
        </div>
      }
    >
      {/* Symbol + quote strip */}
      <section className="eda-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick symbols">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={cn('eda-tab !normal-case !tracking-normal', symbol === s && 'eda-tab-active')}
            >
              {s.slice(0, 3)}/{s.slice(3)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[12px]">
          <span className="font-semibold text-foreground">{inst?.displaySymbol ?? symbol}</span>
          {quote ? (
            <>
              <span className="text-buy">BID {fxNum(quote.bid, digits)}</span>
              <span className="text-sell">ASK {fxNum(quote.ask, digits)}</span>
              <span className="text-muted-foreground">SPR {quote.spreadPips}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Quote loading…</span>
          )}
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', sessionOpen ? 'border-buy/30 text-buy' : 'border-sell/30 text-sell')}>
            {sessionOpen ? 'Session open' : sessions?.eligibility.reason ?? 'Session closed'}
          </span>
        </div>
      </section>

      {/* Chart */}
      <section className="overflow-hidden rounded-xl border border-border bg-card" style={{ height: 'min(62vh, 560px)' }}>
        <div className="relative h-full min-h-[420px]">
          <ForexChartFoundation />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Indicators */}
        <section className="eda-card p-4 xl:col-span-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Indicators · {tf || '15m'} · analysis only
          </h2>
          {candles.status !== 'READY' ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Historical market data unavailable.</p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="SMA 20" value={fmt(indicators?.sma20)} />
              <Metric label="EMA 20" value={fmt(indicators?.ema20)} />
              <Metric label="RSI 14" value={fmt(indicators?.rsi14)} className={rsiTone(indicators?.rsi14)} />
              <Metric label="MACD" value={fmt(indicators?.macd)} />
              <Metric label="BB mid" value={fmt(indicators?.bollinger?.mid)} />
              <Metric label="BB upper" value={fmt(indicators?.bollinger?.upper)} />
              <Metric label="BB lower" value={fmt(indicators?.bollinger?.lower)} />
              <Metric label="ATR 14" value={fmt(indicators?.atr14)} />
              <Metric label="Stoch 14" value={fmt(indicators?.stoch14)} />
              <Metric label="Bars" value={String(candles.candles.length)} />
            </dl>
          )}
          {volatility ? (
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 font-mono text-[11px]">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Volatility (OHLC-derived)</p>
              <p className="mt-1 text-foreground">
                ATR ≈ {volatility.atrPips != null ? `${volatility.atrPips.toFixed(1)} pips` : 'n/a'}
              </p>
              <p className="text-foreground">
                Today range ≈ {volatility.dayRange != null ? `${volatility.dayRange.toFixed(1)} pips` : 'n/a'}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Methodology: ATR14 = avg true range ÷ instrument pip size. Today = UTC day high−low in pips.
              </p>
            </div>
          ) : null}
        </section>

        {/* MTF + Sessions */}
        <section className="eda-card space-y-4 p-4 xl:col-span-1">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Multi-timeframe · Derived analysis
            </h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Rule: EMA20 vs EMA50 on each TF. Not a prediction. Not AI.
            </p>
            <ul className="mt-3 space-y-1.5">
              {mtf.length === 0 ? (
                <li className="text-[12px] text-muted-foreground">Computing…</li>
              ) : (
                mtf.map((row) => (
                  <li key={row.tf} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                    <button
                      type="button"
                      className="font-mono text-[12px] font-semibold text-primary hover:underline"
                      onClick={() => setTf(row.tf)}
                    >
                      {row.tf}
                    </button>
                    <span
                      className={cn(
                        'text-[11px] font-semibold uppercase',
                        row.bias === 'Bullish' ? 'text-buy' : row.bias === 'Bearish' ? 'text-sell' : 'text-muted-foreground'
                      )}
                      title={row.detail}
                    >
                      {row.bias}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Sessions</h2>
            <dl className="mt-2 space-y-1 font-mono text-[12px] text-muted-foreground">
              <div className="flex justify-between">
                <dt>Active</dt>
                <dd className="text-foreground">
                  {sessions?.eligibility.sessions?.length ? sessions.eligibility.sessions.join(', ') : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>London / NY overlap</dt>
                <dd className={overlap ? 'text-buy' : 'text-muted-foreground'}>{overlap ? 'Active (12–16 UTC)' : 'Inactive'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Eligibility</dt>
                <dd className={sessionOpen ? 'text-buy' : 'text-sell'}>{sessions?.eligibility.reason ?? '—'}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[10px] text-muted-foreground">Backend sessions remain authoritative. UTC overlap is textbook guidance.</p>
          </div>
        </section>

        {/* Levels */}
        <section className="eda-card p-4 xl:col-span-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Important levels · from loaded OHLC
          </h2>
          {levels.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Load history on the chart to derive DO / PDH / PDL / WO / PWH / PWL / MO.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 font-mono text-[12px]">
              {levels.map((lv) => (
                <li key={lv.id} className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5">
                  <span
                    className={cn(
                      'font-semibold',
                      lv.id.includes('H') ? 'text-buy' : lv.id.includes('L') ? 'text-sell' : 'text-primary'
                    )}
                  >
                    {lv.label}
                  </span>
                  <span className="text-foreground">{fxNum(lv.price, digits)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`${FOREX_ROUTES.trade}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
            >
              Open in terminal
            </Link>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-[11px] font-semibold"
              onClick={() => setCurrencyFilter(symbolCcys[0] ?? 'ALL')}
            >
              Filter calendar {symbolCcys[0]}
            </button>
          </div>
        </section>
      </div>

      {/* Intel tabs */}
      <section className="eda-card p-4">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          {(['calendar', 'news', 'levels', 'sessions'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={intelTab === t}
              onClick={() => setIntelTab(t)}
              className={cn('eda-tab capitalize', intelTab === t && 'eda-tab-active')}
            >
              {t}
            </button>
          ))}
        </div>

        {intelTab === 'calendar' ? (
          <div className="mt-4">
            {calendar?.availability === 'UNAVAILABLE' || !calendar ? (
              <p className="text-[13px] text-muted-foreground">
                Economic calendar unavailable{calendar?.reason ? ` (${calendar.reason})` : ''}.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Source {calendar.provider ?? 'external'} · this-week feed. Actual only when provider supplies it.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                  {(['ALL', 'High', 'Medium', 'Low'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={impactFilter === level}
                      onClick={() => setImpactFilter(level)}
                      className={cn('eda-tab', impactFilter === level && 'eda-tab-active')}
                    >
                      {level}
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-1">
                    <span className="text-muted-foreground">Currency</span>
                    <select
                      value={currencyFilter}
                      onChange={(e) => setCurrencyFilter(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background px-2"
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
                  <p className="mt-3 text-[13px] text-muted-foreground">No calendar events for this filter.</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {calendarRows.slice(0, 40).map((ev, i) => (
                      <article key={`${ev.event}-${ev.time}-${i}`} className="eda-card-interactive px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-medium text-foreground">
                              {ev.currency ? `${ev.currency} · ` : ''}
                              {ev.event}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {ev.time ? new Date(ev.time).toLocaleString() : 'Time unavailable'}
                            </p>
                          </div>
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', impactTone(ev.impact))}>
                            {ev.impact ?? 'n/a'}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-muted-foreground">
                          <div>
                            <dt>Prev</dt>
                            <dd className="text-foreground">{ev.previous ?? '—'}</dd>
                          </div>
                          <div>
                            <dt>Fcst</dt>
                            <dd className="text-foreground">{ev.forecast ?? '—'}</dd>
                          </div>
                          <div>
                            <dt>Act</dt>
                            <dd className="text-foreground">{ev.actual ?? '—'}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {intelTab === 'news' ? (
          <div className="mt-4">
            {!news || news.availability === 'UNAVAILABLE' ? (
              <p className="text-[13px] text-muted-foreground">
                No market news available{news?.reason ? ` (${news.reason})` : ''}.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Source {news.provider ?? 'rss'} · headlines are not auto-tagged to instruments unless currency is provided.
                </p>
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {news.items.slice(0, 24).map((item, i) => (
                    <li key={`${item.headline}-${i}`} className="eda-card-interactive px-3 py-2.5 text-[13px]">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.time ? new Date(item.time).toLocaleString() : ''}
                        {item.source ? ` · ${item.source}` : ''}
                        {item.currency ? ` · ${item.currency}` : ''}
                      </p>
                      {item.url ? (
                        <a href={item.url} className="mt-1 block font-medium text-foreground underline-offset-2 hover:text-primary hover:underline" target="_blank" rel="noreferrer">
                          {item.headline}
                        </a>
                      ) : (
                        <p className="mt-1 font-medium text-foreground">{item.headline}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}

        {intelTab === 'levels' ? (
          <div className="mt-4">
            {levels.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No levels yet — wait for chart history.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {levels.map((lv) => (
                  <div key={lv.id} className="eda-metric !min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{lv.label}</p>
                    <p className="mt-1 font-mono text-[14px] text-foreground">{fxNum(lv.price, digits)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {intelTab === 'sessions' ? (
          <div className="mt-4 space-y-2 text-[13px] text-muted-foreground">
            <p>
              Current UTC hour: <span className="text-foreground">{hour}:00</span>
            </p>
            <p>
              Reported sessions:{' '}
              <span className="text-foreground">
                {sessions?.eligibility.sessions?.length ? sessions.eligibility.sessions.join(', ') : 'Unavailable'}
              </span>
            </p>
            <p>
              Overlaps:{' '}
              <span className="text-foreground">
                {sessions?.eligibility.overlaps?.length
                  ? sessions.eligibility.overlaps.map((o) => o.join('/')).join(', ')
                  : 'None reported'}
              </span>
            </p>
            <p className="text-[11px]">Use chart Sessions toggle for subtle boundary markers on the OHLC canvas.</p>
          </div>
        ) : null}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Analysis is non-authoritative for trading. Execution, margin and ledger remain on simulated Forex APIs while REAL FOREX is OFF.
      </p>
    </ForexPageFrame>
  );
}

function Metric(props: { label: string; value: string; className?: string }) {
  return (
    <div className="eda-metric !min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{props.label}</dt>
      <dd className={cn('mt-1 font-mono text-[12px]', props.className)}>{props.value}</dd>
    </div>
  );
}
