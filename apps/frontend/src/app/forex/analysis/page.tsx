'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const tForex = useTranslations('forex');
  const ta = useTranslations('forex.analysisPage');
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
  type FeedState<T> =
    | { status: 'loading' }
    | { status: 'error'; reason?: string }
    | { status: 'ready'; data: T };

  const [news, setNews] = useState<
    FeedState<{ availability: string; reason?: string; provider?: string; items: NewsItem[] }>
  >({ status: 'loading' });
  const [calendar, setCalendar] = useState<
    FeedState<{ availability: string; reason?: string; provider?: string; events: CalendarEvent[] }>
  >({ status: 'loading' });
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [mtf, setMtf] = useState<MtfBias[]>([]);
  const [mtfStatus, setMtfStatus] = useState<'loading' | 'ready'>('loading');
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
    let cancelled = false;
    setNews({ status: 'loading' });
    setCalendar({ status: 'loading' });
    void (async () => {
      const [newsRes, calRes] = await Promise.all([forexApi.news(), forexApi.calendar()]);
      if (cancelled) return;
      const n = unwrap(newsRes);
      if (n.ok) {
        setNews({
          status: 'ready',
          data: {
            availability: n.data.availability,
            reason: n.data.reason,
            provider: n.data.provider,
            items: (n.data.items as NewsItem[]) ?? [],
          },
        });
      } else {
        setNews({ status: 'error', reason: n.error.message });
      }
      const c = unwrap(calRes);
      if (c.ok) {
        setCalendar({
          status: 'ready',
          data: {
            availability: c.data.availability,
            reason: c.data.reason,
            provider: c.data.provider,
            events: (c.data.events as CalendarEvent[]) ?? [],
          },
        });
      } else {
        setCalendar({ status: 'error', reason: c.error.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Multi-timeframe EMA20 vs EMA50 — deterministic derived analysis only.
  useEffect(() => {
    let cancelled = false;
    setMtfStatus('loading');
    setMtf([]);
    void (async () => {
      const settled = await Promise.all(
        MTF_TFS.map(async (timeframe) => {
          try {
            const res = await forexApi.candles({ symbol, timeframe, limit: 160 });
            const u = unwrap(res);
            if (!u.ok || u.data.availability !== 'AVAILABLE' || !u.data.candles?.length) {
              return { tf: timeframe, bias: 'n/a' as const, detail: u.ok ? u.data.reason ?? 'No history' : u.error.message };
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
              return { tf: timeframe, bias: 'n/a' as const, detail: `Need ≥50 bars (got ${bars.length})` };
            }
            if (a > b) return { tf: timeframe, bias: 'Bullish' as const, detail: `EMA20 ${a.toFixed(5)} > EMA50 ${b.toFixed(5)}` };
            if (a < b) return { tf: timeframe, bias: 'Bearish' as const, detail: `EMA20 ${a.toFixed(5)} < EMA50 ${b.toFixed(5)}` };
            return { tf: timeframe, bias: 'Neutral' as const, detail: 'EMA20 = EMA50' };
          } catch (err) {
            return {
              tf: timeframe,
              bias: 'n/a' as const,
              detail: err instanceof Error ? err.message : 'Request failed',
            };
          }
        })
      );
      if (!cancelled) {
        setMtf(settled);
        setMtfStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const calendarData = calendar.status === 'ready' ? calendar.data : null;
  const newsData = news.status === 'ready' ? news.data : null;

  const currencies = useMemo(() => {
    const set = new Set((calendarData?.events ?? []).map((e) => e.currency).filter((c): c is string => Boolean(c)));
    return ['ALL', ...Array.from(set).sort()];
  }, [calendarData]);

  const calendarRows = useMemo(() => {
    const now = Date.now();
    return (calendarData?.events ?? [])
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
        const ua = ta >= now - 60_000 ? 0 : 1;
        const ub = tb >= now - 60_000 ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return ta - tb;
      });
  }, [calendarData, impactFilter, currencyFilter]);

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
      dense
      title={tForex('pages.analysis.title')}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`${FOREX_ROUTES.trade}?symbol=${encodeURIComponent(symbol)}`}
            className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Trade {inst?.displaySymbol ?? symbol}
          </Link>
          <Link
            href={FOREX_ROUTES.markets}
            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-[11px] font-semibold hover:border-primary/40"
          >
            Markets
          </Link>
        </div>
      }
    >
      {/* Compact instrument toolbar — commercial, one row */}
      <section className="eda-card flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-1.5">
        <div className="forex-chrome-strip flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="group" aria-label={ta('quickSymbolsAria')}>
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={cn('eda-tab shrink-0 !normal-case !tracking-normal', symbol === s && 'eda-tab-active')}
            >
              {s.slice(0, 3)}/{s.slice(3)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-[11px]">
          {quote ? (
            <>
              <span className="text-buy">BID {fxNum(quote.bid, digits)}</span>
              <span className="text-sell">ASK {fxNum(quote.ask, digits)}</span>
              <span className="text-muted-foreground">SPR {quote.spreadPips}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Quote…</span>
          )}
          <span
            className={cn(
              'rounded-full border px-1.5 py-0.5 text-[9px]',
              sessionOpen ? 'border-buy/30 text-buy' : 'border-sell/30 text-sell'
            )}
          >
            {sessionOpen ? 'Open' : sessions?.eligibility.reason ?? 'Closed'}
          </span>
        </div>
      </section>

      {/* Chart — explicit flex height so LWC canvas is never 0px tall */}
      <section className="flex h-[min(58vh,520px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <ForexChartFoundation embedded />
      </section>

      {/* Dense Tier-0 intel strip — card chips, no empty metric slabs */}
      <div className="grid gap-3 lg:grid-cols-12">
        {/* Indicators */}
        <section className="eda-card p-3 lg:col-span-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Indicators · {tf || '15m'}
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {candles.status === 'READY'
                ? `${candles.candles.length} bars · ${candles.source ?? '—'}`
                : candles.status}
            </span>
          </div>
          {candles.status === 'LOADING' ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Loading OHLC for indicators…</p>
          ) : candles.status !== 'READY' ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Historical data unavailable{candles.reason ? ` · ${candles.reason}` : ''}.
            </p>
          ) : (
            <dl className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              <Metric label="SMA 20" value={fmt(indicators?.sma20)} />
              <Metric label="EMA 20" value={fmt(indicators?.ema20)} />
              <Metric label="RSI 14" value={fmt(indicators?.rsi14)} className={rsiTone(indicators?.rsi14)} />
              <Metric label="Stoch 14" value={fmt(indicators?.stoch14)} />
              <Metric label="MACD" value={fmt(indicators?.macd)} />
              <Metric label="MACD sig" value={fmt(indicators?.macdSignal)} />
              <Metric label="BB mid" value={fmt(indicators?.bollinger?.mid)} />
              <Metric label="BB upper" value={fmt(indicators?.bollinger?.upper)} />
              <Metric label="BB lower" value={fmt(indicators?.bollinger?.lower)} />
              <Metric label="ATR 14" value={fmt(indicators?.atr14)} />
              <Metric
                label="ATR pips"
                value={volatility?.atrPips != null ? volatility.atrPips.toFixed(1) : '—'}
              />
              <Metric
                label="Day rng"
                value={volatility?.dayRange != null ? `${volatility.dayRange.toFixed(1)}p` : '—'}
              />
            </dl>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Analysis only · ATR/day range from OHLC ÷ pip size · not for margin or execution.
          </p>
        </section>

        {/* MTF bias cards */}
        <section className="eda-card p-3 lg:col-span-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Multi-timeframe
            </h2>
            <span className="text-[10px] text-muted-foreground">EMA20 vs EMA50 · not AI</span>
          </div>
          {mtfStatus === 'loading' && mtf.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Computing bias across TFs…</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {mtf.map((row) => (
                <li key={row.tf}>
                  <button
                    type="button"
                    onClick={() => setTf(row.tf)}
                    className={cn(
                      'eda-card-interactive flex w-full flex-col gap-0.5 px-2 py-1.5 text-left',
                      row.bias === 'Bullish' && 'border-buy/35',
                      row.bias === 'Bearish' && 'border-sell/35'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[12px] font-semibold text-primary">{row.tf}</span>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wide',
                          row.bias === 'Bullish' ? 'text-buy' : row.bias === 'Bearish' ? 'text-sell' : 'text-muted-foreground'
                        )}
                      >
                        {row.bias}
                      </span>
                    </div>
                    <span className="truncate font-mono text-[9px] text-muted-foreground">{row.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 font-mono text-[10px]',
                sessionOpen ? 'border-buy/30 text-buy' : 'border-sell/30 text-sell'
              )}
            >
              {sessionOpen ? 'Open' : 'Closed'}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {sessions?.eligibility.sessions?.length ? sessions.eligibility.sessions.join(' · ') : 'No session'}
            </span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 font-mono text-[10px]',
                overlap ? 'border-buy/30 text-buy' : 'border-border text-muted-foreground'
              )}
            >
              L/NY {overlap ? 'overlap' : 'off'}
            </span>
          </div>
        </section>

        {/* Levels */}
        <section className="eda-card p-3 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{tForex('intelDrawer.tabs.levels')}</h2>
            <span className="text-[10px] text-muted-foreground">{ta('ohlcDerived')}</span>
          </div>
          {candles.status === 'LOADING' ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Deriving levels…</p>
          ) : levels.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">{ta('waitForChartHistory')}</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {levels.map((lv) => (
                <li
                  key={lv.id}
                  className="flex items-center justify-between gap-1 rounded-md border border-border/70 bg-muted/15 px-2 py-1.5 font-mono text-[11px]"
                >
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase',
                      lv.id.includes('H') ? 'text-buy' : lv.id.includes('L') ? 'text-sell' : 'text-primary'
                    )}
                  >
                    {lv.label}
                  </span>
                  <span className="tabular-nums text-foreground">{fxNum(lv.price, digits)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href={`${FOREX_ROUTES.trade}?symbol=${encodeURIComponent(symbol)}`}
              className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[10px] font-semibold text-primary-foreground"
            >
              Terminal
            </Link>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-[10px] font-semibold"
              onClick={() => {
                setCurrencyFilter(symbolCcys[0] ?? 'ALL');
                setIntelTab('calendar');
              }}
            >
              Cal {symbolCcys[0]}
            </button>
          </div>
        </section>
      </div>

      {/* Intel tabs — dense calendar / news cards */}
      <section className="eda-card p-3">
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
          <div className="mt-3">
            {calendar.status === 'loading' ? (
              <p className="text-[12px] text-muted-foreground">Loading economic calendar…</p>
            ) : calendar.status === 'error' ? (
              <p className="text-[12px] text-muted-foreground">
                Calendar request failed{calendar.reason ? ` · ${calendar.reason}` : ''}.
              </p>
            ) : !calendarData || calendarData.availability === 'UNAVAILABLE' ? (
              <p className="text-[12px] text-muted-foreground">
                Economic calendar unavailable{calendarData?.reason ? ` (${calendarData.reason})` : ''}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="mr-auto text-[10px] text-muted-foreground">
                    {calendarData.provider ?? 'external'} · {calendarRows.length}/{calendarData.events.length} shown · Actual when
                    supplied
                  </p>
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
                  <label className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground">{ta('currencyShort')}</span>
                    <select
                      value={currencyFilter}
                      onChange={(e) => setCurrencyFilter(e.target.value)}
                      className="h-7 rounded-md border border-border bg-background px-1.5 text-[11px]"
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
                  <p className="mt-2 text-[12px] text-muted-foreground">{ta('noCalendarEvents')}</p>
                ) : (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {calendarRows.slice(0, 60).map((ev, i) => (
                      <article key={`${ev.event}-${ev.time}-${i}`} className="eda-card-interactive px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-foreground">
                              {ev.currency ? `${ev.currency} · ` : ''}
                              {ev.event}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {ev.time ? new Date(ev.time).toLocaleString() : 'Time n/a'}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                              impactTone(ev.impact)
                            )}
                          >
                            {ev.impact ?? 'n/a'}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                          P <span className="text-foreground">{ev.previous ?? '—'}</span>
                          <span className="mx-1.5 text-border">|</span>
                          F <span className="text-foreground">{ev.forecast ?? '—'}</span>
                          <span className="mx-1.5 text-border">|</span>
                          A <span className="text-foreground">{ev.actual ?? '—'}</span>
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {intelTab === 'news' ? (
          <div className="mt-3">
            {news.status === 'loading' ? (
              <p className="text-[12px] text-muted-foreground">Loading news…</p>
            ) : news.status === 'error' ? (
              <p className="text-[12px] text-muted-foreground">
                News request failed{news.reason ? ` · ${news.reason}` : ''}.
              </p>
            ) : !newsData || newsData.availability === 'UNAVAILABLE' ? (
              <p className="text-[12px] text-muted-foreground">
                No market news available{newsData?.reason ? ` (${newsData.reason})` : ''}.
              </p>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">
                  {newsData.provider ?? 'rss'} · {newsData.items.length} headlines · not auto-tagged unless currency provided
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {newsData.items.slice(0, 36).map((item, i) => (
                    <li key={`${item.headline}-${i}`} className="eda-card-interactive px-2.5 py-2 text-[12px]">
                      <p className="font-mono text-[9px] text-muted-foreground">
                        {item.time ? new Date(item.time).toLocaleString() : ''}
                        {item.source ? ` · ${item.source}` : ''}
                        {item.currency ? ` · ${item.currency}` : ''}
                      </p>
                      {item.url ? (
                        <a
                          href={item.url}
                          className="mt-0.5 line-clamp-2 block font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.headline}
                        </a>
                      ) : (
                        <p className="mt-0.5 line-clamp-2 font-medium text-foreground">{item.headline}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}

        {intelTab === 'levels' ? (
          <div className="mt-3">
            {candles.status === 'LOADING' ? (
              <p className="text-[12px] text-muted-foreground">Loading OHLC to derive levels…</p>
            ) : levels.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">{ta('noLevelsYet')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {levels.map((lv) => (
                  <div
                    key={lv.id}
                    className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5"
                  >
                    <p
                      className={cn(
                        'text-[9px] font-bold uppercase tracking-wide',
                        lv.id.includes('H') ? 'text-buy' : lv.id.includes('L') ? 'text-sell' : 'text-primary'
                      )}
                    >
                      {lv.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] tabular-nums text-foreground">{fxNum(lv.price, digits)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {intelTab === 'sessions' ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-md border border-border bg-muted/15 px-2.5 py-1.5 font-mono text-[11px]">
              UTC <span className="text-foreground">{hour}:00</span>
            </span>
            <span className="rounded-md border border-border bg-muted/15 px-2.5 py-1.5 font-mono text-[11px]">
              Active{' '}
              <span className="text-foreground">
                {sessions?.eligibility.sessions?.length ? sessions.eligibility.sessions.join(', ') : '—'}
              </span>
            </span>
            <span
              className={cn(
                'rounded-md border px-2.5 py-1.5 font-mono text-[11px]',
                overlap ? 'border-buy/30 bg-buy/10 text-buy' : 'border-border bg-muted/15 text-muted-foreground'
              )}
            >
              L/NY {overlap ? 'overlap 12–16' : 'off'}
            </span>
            <span
              className={cn(
                'rounded-md border px-2.5 py-1.5 font-mono text-[11px]',
                sessionOpen ? 'border-buy/30 bg-buy/10 text-buy' : 'border-sell/30 bg-sell/10 text-sell'
              )}
            >
              {sessions?.eligibility.reason ?? (sessionOpen ? 'OPEN' : 'CLOSED')}
            </span>
            <span className="rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-[10px] text-muted-foreground">
              Overlaps:{' '}
              {sessions?.eligibility.overlaps?.length
                ? sessions.eligibility.overlaps.map((o) => o.join('/')).join(', ')
                : 'none'}
            </span>
          </div>
        ) : null}
      </section>

      <p className="text-[10px] text-muted-foreground">
        Analysis only · not used for execution, margin or ledger · demo quotes / simulated execution.
      </p>
    </ForexPageFrame>
  );
}

function Metric(props: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
      <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{props.label}</dt>
      <dd className={cn('mt-0.5 font-mono text-[12px] font-semibold tabular-nums leading-tight', props.className)}>
        {props.value}
      </dd>
    </div>
  );
}
