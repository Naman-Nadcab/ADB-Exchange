'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { FOREX_CANDLE_RESERVED_TIMEFRAMES, isReservedForexTimeframe } from '@/lib/forex/models/candles';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { lastAtr, lastMacd, lastStochastic, type FxBar } from '@/lib/forex/local-indicators';
import { bollinger, ema, hma, macdSeries, nearestStudy, rsi, sma, supertrend, wma } from '@/lib/forex/chart/studies';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { activeProtectionsFor } from '@/lib/forex/models/position';
import { decideQuoteChartOverlay } from '@/lib/forex/market-data/quote-chart-overlay';
import { deriveStructureLevels } from '@/lib/forex/chart/structure-levels';
import { computeRiskReward, pipSizeFromInstrument, priceChangePct, priceDistancePips } from '@/lib/forex/chart/pip-math';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import {
  ForexLightweightChart,
  type ForexChartApi,
  type ForexChartCrosshair,
  type ForexChartType,
} from './ForexLightweightChart';
import { ForexChartToolbar, type ForexAnalysisTool } from './ForexChartToolbar';
import { ForexIntelDrawer } from './ForexIntelDrawer';
import { fxNum } from './format';
import { cn } from '@/lib/utils';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';

type StudyId = 'none' | 'ema20_50' | 'sma20' | 'ema20' | 'wma20' | 'hma21' | 'bb20' | 'supertrend';

const CHART_TYPES: Array<{ id: ForexChartType; label: string }> = [
  { id: 'candle', label: 'Candles' },
  { id: 'ohlc', label: 'OHLC' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
];

const ALERTS_KEY = 'eda-forex-local-alerts-v1';

type LocalAlert = { id: string; symbol: string; side: 'above' | 'below'; price: string };

function useTerminalChartDark(): boolean {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const sync = () => {
      const root = document.documentElement;
      if (root.classList.contains('dark')) {
        setDark(true);
        return;
      }
      if (root.classList.contains('light')) {
        setDark(false);
        return;
      }
      setDark(Boolean(document.querySelector('.terminal-shell')));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function orderedTimeframes(supported: string[]): string[] {
  return FOREX_CANDLE_RESERVED_TIMEFRAMES.filter((tf) => supported.includes(tf));
}

function loadAlerts(): LocalAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalAlert[];
  } catch {
    return [];
  }
}

export function ForexChartFoundation(props?: {
  embedded?: boolean;
  instanceId?: string;
  symbol?: string;
  timeframe?: string;
  active?: boolean;
  compactChrome?: boolean;
  showOneClick?: boolean;
  onActivate?: () => void;
  onSymbolChange?: (symbol: string) => void;
  onTimeframeChange?: (tf: string) => void;
}) {
  const embedded = Boolean(props?.embedded);
  const storeSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const storedTf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setStoreTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const setStoreSymbol = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const selected = (props?.symbol ?? storeSymbol).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const setTf = (tf: string) => {
    if (props?.onTimeframeChange) props.onTimeframeChange(tf);
    else setStoreTf(tf);
  };
  const activate = () => {
    props?.onActivate?.();
    setStoreSymbol(selected);
  };
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const socketState = useForexStore((s) => s.socketState);
  const quotes = useForexStore((s) => s.quotes);
  const providers = useForexStore((s) => s.providerHealth);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const connection = deriveDisplayConnection({
    socketState,
    quotes,
    selectedSymbol: selected,
    providers,
    hydratePhase,
  });
  const dark = useTerminalChartDark();
  const [study, setStudy] = useState<StudyId>('ema20_50');
  const [chartType, setChartType] = useState<ForexChartType>('candle');
  const [crosshair, setCrosshair] = useState<ForexChartCrosshair | null>(null);
  const [tool, setTool] = useState<ForexAnalysisTool>('none');
  const [showSessions, setShowSessions] = useState(false);
  const [showLevels, setShowLevels] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; price: number; time: number | null } | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<
    Array<{ time?: string | null; currency?: string | null; event?: string; impact?: string; previous?: string | null; forecast?: string | null; actual?: string | null }>
  >([]);
  const [calendarMeta, setCalendarMeta] = useState<{ available: boolean; reason?: string }>({ available: false });
  const [newsItems, setNewsItems] = useState<Array<{ time?: string | null; headline?: string; source?: string; currency?: string | null }>>([]);
  const [newsMeta, setNewsMeta] = useState<{ available: boolean; reason?: string }>({ available: false });
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  const [rrPoints, setRrPoints] = useState<number[]>([]);
  const [measurePoints, setMeasurePoints] = useState<Array<{ price: number; time: number | null }>>([]);
  const chartApiRef = useRef<ForexChartApi | null>(null);
  const orderEngine = useForexOrderEngine();
  const positions = useForexStore((s) => s.positions);
  const protections = useForexStore((s) => s.protections);
  const orders = useForexStore((s) => s.orders);
  const sessions = useForexStore((s) => s.sessions);

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  useEffect(() => {
    if (!showCalendar && !showIntel) return;
    let cancelled = false;
    void forexApi.calendar().then((res) => {
      if (cancelled) return;
      const u = unwrap(res);
      if (!u.ok) {
        setCalendarEvents([]);
        setCalendarMeta({ available: false, reason: u.error.message });
        return;
      }
      const data = u.data as { availability?: string; reason?: string; events?: typeof calendarEvents };
      const events = Array.isArray(data.events) ? data.events : [];
      setCalendarEvents(events);
      setCalendarMeta({ available: data.availability === 'AVAILABLE', reason: data.reason });
    });
    void forexApi.news().then((res) => {
      if (cancelled) return;
      const u = unwrap(res);
      if (!u.ok) {
        setNewsItems([]);
        setNewsMeta({ available: false, reason: u.error.message });
        return;
      }
      const data = u.data as { availability?: string; reason?: string; items?: typeof newsItems };
      setNewsItems(Array.isArray(data.items) ? data.items : []);
      setNewsMeta({ available: data.availability === 'AVAILABLE', reason: data.reason });
    });
    return () => {
      cancelled = true;
    };
  }, [showCalendar, showIntel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartMode, setChartMode]);

  const propTf = props?.timeframe;
  const requestedTf =
    propTf && isReservedForexTimeframe(propTf)
      ? propTf
      : storedTf && isReservedForexTimeframe(storedTf)
        ? storedTf
        : '15m';
  const candleView = useForexCandles(selected, requestedTf);
  const timeframes = orderedTimeframes(candleView.supportedTimeframes.filter(isReservedForexTimeframe));
  const activeTf = timeframes.includes(requestedTf) ? requestedTf : timeframes[0] ?? requestedTf;

  const staleQuote = !quote || isQuoteStale(quote);
  const digits = inst?.digits ?? 5;
  const pipSize = pipSizeFromInstrument({ pipSize: inst?.pipSize, digits });

  const lastClose = useMemo(() => {
    if (candleView.status !== 'READY' || candleView.candles.length === 0) return null;
    const n = Number(candleView.candles[candleView.candles.length - 1].close);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [candleView]);

  const quoteOverlay = useMemo(() => {
    if (!quote) return null;
    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    return decideQuoteChartOverlay({ lastClose, bid, ask });
  }, [quote, lastClose]);

  const chartQuote = quoteOverlay?.overlay ? { bid: quoteOverlay.bid, ask: quoteOverlay.ask } : null;

  const bars: FxBar[] = useMemo(() => {
    if (candleView.status !== 'READY') return [];
    const out: FxBar[] = [];
    for (const c of candleView.candles) {
      const ms = candleTimeMs(c.timestamp);
      if (ms == null) continue;
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      if (![open, high, low, close].every(Number.isFinite)) continue;
      out.push({ time: Math.floor(ms / 1000), open, high, low, close });
    }
    return out;
  }, [candleView]);

  const lastBar = bars.length ? bars[bars.length - 1] : null;
  const ohlcDisplay =
    crosshair?.close != null
      ? crosshair
      : lastBar
        ? {
            time: lastBar.time,
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
            price: lastBar.close,
          }
        : null;

  const overlay = useMemo(() => {
    if (study === 'sma20') return sma(bars, 20);
    if (study === 'ema20' || study === 'ema20_50') return ema(bars, 20);
    if (study === 'wma20') return wma(bars, 20);
    if (study === 'hma21') return hma(bars, 21);
    if (study === 'bb20') return bollinger(bars, 20, 2).mid;
    if (study === 'supertrend') return supertrend(bars);
    return [];
  }, [bars, study]);
  const overlaySecondary = useMemo(
    () => (study === 'ema20_50' ? ema(bars, 50) : []),
    [bars, study]
  );
  const bands = useMemo(() => (study === 'bb20' ? bollinger(bars, 20, 2) : undefined), [bars, study]);
  const studyReady = study === 'none' || overlay.length > 0;
  const rsiSeries = useMemo(() => rsi(bars, 14), [bars]);
  const macdLine = useMemo(() => macdSeries(bars).macd, [bars]);
  const atr = lastAtr(bars);
  const macd = lastMacd(bars);
  const stoch = lastStochastic(bars);

  const hoverIndicators = useMemo(() => {
    if (crosshair?.time == null) return null;
    const t = crosshair.time;
    return {
      ema20: nearestStudy(overlay, t),
      ema50: nearestStudy(overlaySecondary, t),
      rsi: nearestStudy(rsiSeries, t),
      macd: nearestStudy(macdLine, t),
    };
  }, [crosshair, overlay, overlaySecondary, rsiSeries, macdLine]);

  const structureLevels = useMemo(() => {
    if (!showLevels || candleView.status !== 'READY') return [];
    return deriveStructureLevels(candleView.candles);
  }, [showLevels, candleView]);

  const alertPrices = useMemo(
    () =>
      alerts
        .filter((a) => a.symbol === selected)
        .map((a) => Number(a.price))
        .filter((n) => Number.isFinite(n) && n > 0),
    [alerts, selected]
  );

  const rrLevels = useMemo(() => {
    if (rrPoints.length < 3) return null;
    return { entry: rrPoints[0], stop: rrPoints[1], target: rrPoints[2] };
  }, [rrPoints]);

  const rrResult = useMemo(() => {
    if (!rrLevels) return null;
    return computeRiskReward({ ...rrLevels, pipSize });
  }, [rrLevels, pipSize]);

  useEffect(() => {
    if (!rrResult || !rrLevels) return;
    setTicketDraft({
      nonce: Date.now(),
      price: String(rrLevels.entry),
      sl: String(rrLevels.stop),
      tp: String(rrLevels.target),
    });
  }, [rrResult, rrLevels, setTicketDraft]);

  const orderOverlays = useMemo(() => {
    const out: Array<{ price: number; title: string }> = [];
    for (const o of Object.values(orders)) {
      if (o.symbol !== selected) continue;
      const st = String(o.status ?? '').toUpperCase();
      if (!['NEW', 'PARTIAL', 'OPEN', 'WORKING', 'ACCEPTED'].includes(st)) continue;
      const price = Number(o.requestedPrice);
      if (!Number.isFinite(price) || price <= 0) continue;
      out.push({
        price,
        title: `${o.side.toUpperCase()} ${String(o.type).toUpperCase()} ${price}`,
      });
    }
    return out;
  }, [orders, selected]);

  const calendarMarkers = useMemo(() => {
    if (!showCalendar) return [];
    const ccy = selected.slice(0, 3);
    const qccy = selected.slice(3, 6);
    return calendarEvents
      .filter((ev) => {
        const c = String(ev.currency ?? '').toUpperCase();
        return !c || c === ccy || c === qccy;
      })
      .map((ev) => {
        const ms = ev.time ? Date.parse(ev.time) : NaN;
        if (!Number.isFinite(ms)) return null;
        return { time: Math.floor(ms / 1000), text: String(ev.event ?? 'EVT').slice(0, 10) };
      })
      .filter((x): x is { time: number; text: string } => x != null);
  }, [showCalendar, calendarEvents, selected]);

  const dailyRangePips = useMemo(() => {
    if (!bars.length) return null;
    const last = bars[bars.length - 1]!;
    const day = new Date(last.time * 1000);
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}-${day.getUTCDate()}`;
    const today = bars.filter((b) => {
      const d = new Date(b.time * 1000);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}` === key;
    });
    if (!today.length) return null;
    const hi = Math.max(...today.map((b) => b.high));
    const lo = Math.min(...today.map((b) => b.low));
    return priceDistancePips(hi, lo, pipSize);
  }, [bars, pipSize]);

  const measureSummary = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const a = measurePoints[0].price;
    const b = measurePoints[1].price;
    const pips = priceDistancePips(a, b, pipSize);
    const pct = priceChangePct(a, b);
    const t0 = measurePoints[0].time;
    const t1 = measurePoints[1].time;
    let barsCount: number | null = null;
    if (t0 != null && t1 != null && bars.length) {
      const lo = Math.min(t0, t1);
      const hi = Math.max(t0, t1);
      barsCount = bars.filter((x) => x.time >= lo && x.time <= hi).length;
    }
    const parts = [
      pips != null ? `${(b >= a ? '+' : '-')}${pips.toFixed(1)} pips` : null,
      pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : null,
      barsCount != null ? `${barsCount} bars` : null,
    ].filter(Boolean);
    return parts.join(' · ') || null;
  }, [measurePoints, pipSize, bars]);

  const levels = useMemo(() => {
    const open = Object.values(positions).find((p) => p.status === 'OPEN' && p.symbol === selected);
    if (!open) return undefined;
    const prot = activeProtectionsFor(protections, open.positionId);
    const entry = Number(open.averageEntryPrice || open.entryPrice);
    const sl = prot.sl ? Number(prot.sl.triggerPrice) : undefined;
    const tp = prot.tp ? Number(prot.tp.triggerPrice) : undefined;
    return {
      entry: Number.isFinite(entry) ? entry : undefined,
      sl: sl != null && Number.isFinite(sl) ? sl : undefined,
      tp: tp != null && Number.isFinite(tp) ? tp : undefined,
    };
  }, [positions, protections, selected]);

  const quoteFreshness =
    connection === 'DISCONNECTED' || connection === 'CONNECTING' || connection === 'RECONNECTING'
      ? 'DISCONNECTED'
      : connection === 'STALE' || staleQuote
        ? 'STALE'
        : quote
          ? 'LIVE'
          : 'LOADING';

  const quoteModeLabel =
    quoteFreshness === 'LIVE'
      ? quote?.source === 'SIMULATED' || String(quote?.source ?? '').includes('SIMUL')
        ? 'SIMULATED'
        : 'LIVE'
      : quoteFreshness === 'STALE'
        ? 'STALE'
        : quoteFreshness === 'LOADING'
          ? 'CONNECTING'
          : 'UNAVAILABLE';

  const onPricePick = useCallback(
    (price: number, time: number | null) => {
      if (tool === 'alert') {
        const next: LocalAlert = {
          id: `${Date.now()}`,
          symbol: selected,
          side: lastClose != null && price >= lastClose ? 'above' : 'below',
          price: String(price),
        };
        setAlerts((cur) => {
          const merged = [...cur, next];
          try {
            localStorage.setItem(ALERTS_KEY, JSON.stringify(merged));
          } catch {
            /* ignore */
          }
          return merged;
        });
        setTool('none');
        return;
      }
      if (tool === 'measure') {
        setMeasurePoints((cur) => {
          if (cur.length >= 2) return [{ price, time }];
          return [...cur, { price, time }];
        });
        return;
      }
      if (tool === 'rr') {
        setRrPoints((cur) => {
          if (cur.length >= 3) return [price];
          return [...cur, price];
        });
      }
    },
    [tool, selected, lastClose]
  );

  const banners: Array<{ tone: 'neutral' | 'warn' | 'error'; text: string }> = [];
  if (candleView.status === 'LOADING') {
    banners.push({ tone: 'neutral', text: `Loading historical data for ${inst?.displaySymbol ?? selected}…` });
  } else if (candleView.status === 'NO_HISTORY') {
    banners.push({
      tone: 'warn',
      text: `No historical data available for ${inst?.displaySymbol ?? selected} · ${activeTf}.`,
    });
  } else if (candleView.status === 'READY') {
    banners.push({
      tone: 'neutral',
      text: 'Historical data available · Live forming candle unavailable · Alerts LOCAL only.',
    });
  }
  if (tool === 'rr') {
    banners.push({
      tone: 'neutral',
      text:
        rrPoints.length === 0
          ? 'R:R tool: click Entry, then Stop, then Target on the chart.'
          : rrPoints.length === 1
            ? 'R:R: click Stop Loss price.'
            : rrPoints.length === 2
              ? 'R:R: click Take Profit price.'
              : 'R:R complete — adjust by clicking again to restart.',
    });
  }
  if (tool === 'measure') {
    banners.push({
      tone: 'neutral',
      text: measurePoints.length === 0 ? 'Measure: click start price.' : 'Measure: click end price.',
    });
  }

  const calendarForSymbol = useMemo(() => {
    if (!showCalendar || !calendarEvents.length) return [];
    const ccy = selected.slice(0, 3);
    const quoteCcy = selected.slice(3, 6);
    return calendarEvents
      .filter((ev) => {
        const c = String(ev.currency ?? '').toUpperCase();
        return !c || c === ccy || c === quoteCcy || c === 'USD';
      })
      .slice(0, 8);
  }, [showCalendar, calendarEvents, selected]);

  const oneClickBuy = () => {
    if (!props?.showOneClick || !hasForexPrivateSession() || orderEngine.busy) return;
    void orderEngine.place({
      symbol: selected,
      side: 'buy',
      orderType: 'market',
      volume: inst?.minVolume ?? '0.01',
    });
  };
  const oneClickSell = () => {
    if (!props?.showOneClick || !hasForexPrivateSession() || orderEngine.busy) return;
    void orderEngine.place({
      symbol: selected,
      side: 'sell',
      orderType: 'market',
      volume: inst?.minVolume ?? '0.01',
    });
  };

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-col bg-background',
        embedded || props?.instanceId ? 'h-full' : 'flex-1'
      )}
      aria-label="Forex market chart"
      onMouseDown={activate}
    >
      <div className="forex-chrome-strip flex h-8 min-w-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/95 px-2">
        <span className="shrink-0 font-mono text-[13px] font-semibold tracking-tight">
          {inst?.displaySymbol ?? selected}
        </span>
        {activeTf ? (
          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
            {activeTf}
          </span>
        ) : null}
        {quote ? (
          <>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-buy">
              BID {fxNum(quote.bid, digits)}
            </span>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-sell">
              ASK {fxNum(quote.ask, digits)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">SPR {quote.spreadPips}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${quoteModeLabel === 'SIMULATED' || quoteModeLabel === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground'}`}
                aria-hidden
              />
              {quoteModeLabel}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">Loading quote…</span>
        )}

        {ohlcDisplay ? (
          <span className="ml-1 hidden items-center gap-2 font-mono text-[11px] lg:inline-flex">
            <span>
              O <span className="text-foreground">{fxNum(String(ohlcDisplay.open), digits)}</span>
            </span>
            <span>
              H <span className="text-buy">{fxNum(String(ohlcDisplay.high), digits)}</span>
            </span>
            <span>
              L <span className="text-sell">{fxNum(String(ohlcDisplay.low), digits)}</span>
            </span>
            <span>
              C <span className="text-foreground">{fxNum(String(ohlcDisplay.close), digits)}</span>
            </span>
            {hoverIndicators?.ema20 != null ? (
              <span className="text-primary">EMA20 {hoverIndicators.ema20.toFixed(Math.min(digits, 5))}</span>
            ) : null}
            {hoverIndicators?.ema50 != null ? (
              <span className="text-sky-400">EMA50 {hoverIndicators.ema50.toFixed(Math.min(digits, 5))}</span>
            ) : null}
            {hoverIndicators?.rsi != null ? (
              <span className="text-muted-foreground">RSI {hoverIndicators.rsi.toFixed(1)}</span>
            ) : null}
            {hoverIndicators?.macd != null ? (
              <span className="text-muted-foreground">MACD {hoverIndicators.macd.toFixed(5)}</span>
            ) : null}
            {candleView.status === 'READY' ? (
              <span className="text-muted-foreground">{candleView.candles.length} bars</span>
            ) : null}
          </span>
        ) : null}

        {timeframes.length > 0 ? (
          <div className="ml-1 flex items-center gap-0.5" role="group" aria-label="Forex timeframes">
            {timeframes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={activeTf === t}
                onClick={() => setTf(t)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTf === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ml-1 hidden items-center gap-0.5 sm:flex" role="group" aria-label="Chart type">
          {CHART_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={chartType === t.id}
              onClick={() => setChartType(t.id)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                chartType === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="ml-1 hidden items-center gap-1 text-[10px] text-muted-foreground md:inline-flex">
          Study
          <select
            value={study}
            onChange={(e) => setStudy(e.target.value as StudyId)}
            className="rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Chart study"
          >
            <option value="ema20_50">EMA 20/50</option>
            <option value="ema20">EMA 20</option>
            <option value="sma20">SMA 20</option>
            <option value="wma20">WMA 20</option>
            <option value="hma21">HMA 21</option>
            <option value="bb20">Bollinger 20</option>
            <option value="supertrend">Supertrend</option>
            <option value="none">None</option>
          </select>
        </label>

        <span className="hidden font-mono text-[10px] text-muted-foreground xl:inline">
          {atr != null ? `ATR ${atr.toFixed(Math.min(digits, 5))}` : 'ATR n/a'}
          {macd ? ` · MACD ${macd.macd.toFixed(5)}` : ''}
          {stoch ? ` · Stoch ${stoch.k.toFixed(1)}` : ''}
        </span>
        {!studyReady ? <span className="text-[10px] text-muted-foreground">Insufficient history</span> : null}

        {props?.showOneClick ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={orderEngine.busy || !hasForexPrivateSession()}
              onClick={oneClickSell}
              className="h-6 rounded bg-sell px-2 font-mono text-[10px] font-bold text-white disabled:opacity-40"
            >
              SELL
            </button>
            <button
              type="button"
              disabled={orderEngine.busy || !hasForexPrivateSession()}
              onClick={oneClickBuy}
              className="h-6 rounded bg-buy px-2 font-mono text-[10px] font-bold text-white disabled:opacity-40"
            >
              BUY
            </button>
          </div>
        ) : !embedded && !props?.instanceId ? (
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setChartMode(chartMode === 'expand' ? 'normal' : 'expand')}
              aria-pressed={chartMode === 'expand'}
            >
              {chartMode === 'expand' ? 'Restore' : 'Expand'}
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen')}
              aria-pressed={chartMode === 'fullscreen'}
            >
              {chartMode === 'fullscreen' ? 'Exit FS' : 'Fullscreen'}
            </button>
          </div>
        ) : (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {candleView.status === 'READY' ? `${candleView.candles.length} bars` : candleView.status}
          </span>
        )}
      </div>
      {props?.showOneClick && orderEngine.lastNote ? (
        <p className="border-b border-border px-2 py-0.5 text-[10px] text-muted-foreground">{orderEngine.lastNote}</p>
      ) : null}

      {!props?.compactChrome || props?.active ? (
        <ForexChartToolbar
          tool={tool}
          onTool={(t) => {
            setTool(t);
            if (t === 'rr') setRrPoints([]);
            if (t === 'measure') setMeasurePoints([]);
            chartApiRef.current?.setTool(t);
          }}
          showSessions={showSessions}
          onSessions={setShowSessions}
          showLevels={showLevels}
          onLevels={setShowLevels}
          showRsi={showRsi}
          onRsi={setShowRsi}
          showMacd={showMacd}
          onMacd={setShowMacd}
          showCalendar={showCalendar}
          onCalendar={setShowCalendar}
          showIntel={showIntel}
          onIntel={setShowIntel}
          onClearDrawings={() => chartApiRef.current?.clearDrawings()}
          rrSummary={
            rrResult
              ? `Risk ${rrResult.riskPips.toFixed(1)}p · Reward ${rrResult.rewardPips.toFixed(1)}p · R:R ${rrResult.rr.toFixed(2)}`
              : null
          }
          measureSummary={measureSummary}
        />
      ) : null}

      {showCalendar && calendarForSymbol.length > 0 ? (
        <div className="flex h-7 min-w-0 items-center gap-3 overflow-x-auto border-b border-border/70 bg-card/40 px-2 text-[10px] text-muted-foreground">
          <span className="shrink-0 font-medium text-foreground">Calendar</span>
          {calendarForSymbol.map((ev, i) => (
            <span key={`${ev.time}-${i}`} className="shrink-0 whitespace-nowrap">
              <span className="text-primary">{String(ev.impact ?? '').slice(0, 1).toUpperCase() || '·'}</span>{' '}
              {ev.currency} {ev.event}
              {ev.time ? ` · ${new Date(ev.time).toLocaleString()}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      <div className={cn('relative min-h-0 flex-1', embedded && 'min-h-[280px]')}>
        <ForexLightweightChart
          candles={candleView.status === 'READY' ? candleView.candles : []}
          quote={chartQuote}
          dark={dark}
          digits={digits}
          chartType={chartType}
          overlay={overlay}
          overlaySecondary={overlaySecondary}
          bands={bands}
          levels={levels}
          structureLevels={structureLevels}
          alertPrices={alertPrices}
          rrLevels={rrLevels}
          showSessions={showSessions}
          showRsi={showRsi}
          rsi={rsiSeries}
          showMacd={showMacd}
          macd={macdLine}
          orderOverlays={orderOverlays}
          calendarMarkers={calendarMarkers}
          tool={tool}
          drawingsKey={`eda-forex-drawings:${props?.instanceId ?? 'main'}:${selected}:${activeTf}`}
          onCrosshair={setCrosshair}
          onPricePick={onPricePick}
          onContextMenuPrice={(price, time, x, y) => setCtxMenu({ price, time, x, y })}
          onApi={(api) => {
            chartApiRef.current = api;
          }}
        />
        {candleView.status === 'NO_HISTORY' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-border bg-card/95 p-4 text-center shadow-lg">
              <p className="text-sm font-medium text-foreground">Historical data unavailable</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                No OHLC for {inst?.displaySymbol ?? selected} on {activeTf}.
              </p>
            </div>
          </div>
        ) : null}
        {banners.length > 0 && candleView.status !== 'NO_HISTORY' ? (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-col gap-1">
            {banners.slice(0, 1).map((banner) => (
              <div
                key={banner.text}
                role={banner.tone === 'error' ? 'alert' : 'status'}
                className={`rounded border px-2 py-1 text-[10px] leading-relaxed backdrop-blur-sm ${
                  banner.tone === 'error'
                    ? 'border-sell/40 bg-sell/10 text-sell'
                    : banner.tone === 'warn'
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/70 bg-card/85 text-muted-foreground'
                }`}
              >
                {banner.text}
              </div>
            ))}
          </div>
        ) : null}
        <ForexIntelDrawer
          open={showIntel}
          onClose={() => setShowIntel(false)}
          levels={structureLevels}
          digits={digits}
          events={calendarEvents}
          news={newsItems}
          newsAvailable={newsMeta.available}
          newsReason={newsMeta.reason}
          calendarAvailable={calendarMeta.available}
          calendarReason={calendarMeta.reason}
          atrPips={atr != null && pipSize > 0 ? atr / pipSize : null}
          dailyRangePips={dailyRangePips}
          sessionLabel={
            sessions?.eligibility.sessions?.length
              ? sessions.eligibility.sessions.join(', ')
              : sessions?.eligibility.reason ?? 'Unknown'
          }
        />
        {ctxMenu ? (
          <div
            className="fixed z-40 min-w-[160px] rounded-md border border-border bg-card py-1 text-[11px] shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            role="menu"
          >
            <CtxItem
              label={`Copy ${fxNum(ctxMenu.price, digits)}`}
              onClick={() => {
                void navigator.clipboard?.writeText(String(ctxMenu.price));
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Add horizontal line"
              onClick={() => {
                setTool('hline');
                chartApiRef.current?.setTool('hline');
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Measure from here"
              onClick={() => {
                setTool('measure');
                setMeasurePoints([{ price: ctxMenu.price, time: ctxMenu.time }]);
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="R:R from here"
              onClick={() => {
                setTool('rr');
                setRrPoints([ctxMenu.price]);
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Alert at price"
              onClick={() => {
                const next = {
                  id: `${Date.now()}`,
                  symbol: selected,
                  side: (lastClose != null && ctxMenu.price >= lastClose ? 'above' : 'below') as 'above' | 'below',
                  price: String(ctxMenu.price),
                };
                setAlerts((cur) => {
                  const merged = [...cur, next];
                  try {
                    localStorage.setItem(ALERTS_KEY, JSON.stringify(merged));
                  } catch {
                    /* ignore */
                  }
                  return merged;
                });
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Trade from price (limit)"
              onClick={() => {
                setTicketDraft({
                  nonce: Date.now(),
                  price: String(ctxMenu.price),
                  orderType: 'limit',
                  side: lastClose != null && ctxMenu.price < lastClose ? 'buy' : 'sell',
                });
                setCtxMenu(null);
              }}
            />
            {quote ? (
              <>
                <CtxItem
                  label={
                    Number(quote.ask) > 0 && ctxMenu.price < Number(quote.ask)
                      ? `Buy Limit @ ${fxNum(ctxMenu.price, digits)}`
                      : `Buy Stop @ ${fxNum(ctxMenu.price, digits)}`
                  }
                  onClick={() => {
                    const ask = Number(quote.ask);
                    const isLimit = Number.isFinite(ask) && ask > 0 && ctxMenu.price < ask;
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: isLimit ? 'limit' : 'stop',
                      side: 'buy',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={
                    Number(quote.bid) > 0 && ctxMenu.price > Number(quote.bid)
                      ? `Sell Limit @ ${fxNum(ctxMenu.price, digits)}`
                      : `Sell Stop @ ${fxNum(ctxMenu.price, digits)}`
                  }
                  onClick={() => {
                    const bid = Number(quote.bid);
                    const isLimit = Number.isFinite(bid) && bid > 0 && ctxMenu.price > bid;
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: isLimit ? 'limit' : 'stop',
                      side: 'sell',
                    });
                    setCtxMenu(null);
                  }}
                />
              </>
            ) : null}
            {levels?.entry != null ? (
              <>
                <CtxItem
                  label={`Set SL @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    const open = Object.values(positions).find((p) => p.status === 'OPEN' && p.symbol === selected);
                    if (!open) {
                      setCtxMenu(null);
                      return;
                    }
                    const existing = activeProtectionsFor(protections, open.positionId).sl;
                    void (async () => {
                      if (existing) await forexApi.cancelProtection(existing.protectionId);
                      await forexApi.createProtection({
                        clientProtectionId: `sl-chart-${Date.now()}`,
                        positionId: open.positionId,
                        type: 'STOP_LOSS',
                        triggerPrice: String(ctxMenu.price),
                      });
                      await hydrateForexPrivate();
                    })();
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Set TP @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    const open = Object.values(positions).find((p) => p.status === 'OPEN' && p.symbol === selected);
                    if (!open) {
                      setCtxMenu(null);
                      return;
                    }
                    const existing = activeProtectionsFor(protections, open.positionId).tp;
                    void (async () => {
                      if (existing) await forexApi.cancelProtection(existing.protectionId);
                      await forexApi.createProtection({
                        clientProtectionId: `tp-chart-${Date.now()}`,
                        positionId: open.positionId,
                        type: 'TAKE_PROFIT',
                        triggerPrice: String(ctxMenu.price),
                      });
                      await hydrateForexPrivate();
                    })();
                    setCtxMenu(null);
                  }}
                />
              </>
            ) : null}
            <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" onClick={() => setCtxMenu(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CtxItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={onClick}>
      {label}
    </button>
  );
}
