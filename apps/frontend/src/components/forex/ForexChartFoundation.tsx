'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { FOREX_CANDLE_RESERVED_TIMEFRAMES, isReservedForexTimeframe } from '@/lib/forex/models/candles';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { lastAtr, lastMacd, lastStochastic, type FxBar } from '@/lib/forex/local-indicators';
import {
  FOREX_INDICATOR_REGISTRY,
  getForexIndicatorDefinition,
  type StoredForexIndicator,
} from '@/lib/forex/chart/indicator-registry';
import { loadScopedForexIndicators, saveScopedForexIndicators } from '@/lib/forex/chart/indicator-state';
import type { OscillatorPaneSpec } from './ForexOscillatorPaneStack';
import { bollinger, ema, hma, macdSeries, nearestStudy, rsi, sma, supertrend, wma } from '@/lib/forex/chart/studies';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { activeProtectionsFor, chartLinkedOpenPosition } from '@/lib/forex/models/position';
import { decideQuoteChartOverlay } from '@/lib/forex/market-data/quote-chart-overlay';
import { deriveStructureLevels } from '@/lib/forex/chart/structure-levels';
import { buildDraggablePendingLines, FOREX_CHART_PENDING_STATUSES } from '@/lib/forex/chart/pending-order-lines';
import { computeRiskReward, pipSizeFromInstrument, priceChangePct, priceDistancePips } from '@/lib/forex/chart/pip-math';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import {
  ForexLightweightChart,
  type ForexChartApi,
  type ForexChartCrosshair,
  type ForexChartType,
} from './ForexLightweightChart';
import type { ForexAnalysisTool } from './ForexChartToolbar';
import { ForexMt5ChartChrome } from './mt5-chart/ForexMt5ChartChrome';
import { ForexMt5DrawingRail } from './mt5-chart/ForexMt5DrawingRail';
import { ForexMt5EventStrip } from './mt5-chart/ForexMt5EventStrip';
import { ForexMt5DataWindow } from './mt5-chart/ForexMt5DataWindow';
import { ForexMt5ObjectsPanel, objectRowsFromApi, type ObjectPanelRow } from './mt5-chart/ForexMt5ObjectsPanel';
import { ForexIntelDrawer } from './ForexIntelDrawer';
import { fxNum } from './format';
import { cn } from '@/lib/utils';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexPositionActions } from '@/lib/forex/runtime/useForexPositionActions';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import type { ForexProtectionType } from '@/lib/forex/models/types';

type StudyId = 'none' | 'ema20_50' | 'sma20' | 'ema20' | 'wma20' | 'hma21' | 'bb20' | 'supertrend';

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
  const tc = useTranslations('forex.chartFoundation');
  const embedded = Boolean(props?.embedded);
  const storeSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const storedTf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setStoreTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const setStoreSymbol = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
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
  const [studyPeriod, setStudyPeriod] = useState(20);
  const [indicatorStack, setIndicatorStack] = useState<StoredForexIndicator[]>([]);

  const addRegistryIndicator = useCallback((id: string) => {
    if (id === 'none') return;
    const def = getForexIndicatorDefinition(id);
    if (!def) return;
    const params = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
    setIndicatorStack((cur) => [...cur.filter((c) => c.id !== id), { id, enabled: true, params }]);
    if (def.pane === 'overlay') {
      if (id === 'ema') setStudy('ema20');
      else if (id === 'sma') setStudy('sma20');
      else if (id === 'wma') setStudy('wma20');
      else if (id === 'bb') setStudy('bb20');
    }
  }, []);

  const removeRegistryIndicator = useCallback((id: string) => {
    setIndicatorStack((cur) => cur.filter((c) => c.id !== id));
  }, []);

  const updateRegistryIndicatorParam = useCallback((id: string, key: string, value: number) => {
    setIndicatorStack((cur) =>
      cur.map((row) => (row.id === id ? { ...row, params: { ...row.params, [key]: value } } : row))
    );
  }, []);
  const [chartType, setChartType] = useState<ForexChartType>('candle');
  const [crosshair, setCrosshair] = useState<ForexChartCrosshair | null>(null);
  const [tool, setTool] = useState<ForexAnalysisTool>('none');
  const analysisToolRef = useRef<ForexAnalysisTool>('none');
  analysisToolRef.current = tool;
  const [showSessions, setShowSessions] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [objectsPanelOpen, setObjectsPanelOpen] = useState(false);
  const [dataWindowOpen, setDataWindowOpen] = useState(true);
  const [objectRows, setObjectRows] = useState<ObjectPanelRow[]>([]);
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
  const [protectionNote, setProtectionNote] = useState<string | null>(null);
  const chartApiRef = useRef<ForexChartApi | null>(null);
  const orderEngine = useForexOrderEngine();
  const positionActions = useForexPositionActions();
  const chartAuthed = useForexPrivateSession();
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

  useEffect(() => {
    setIndicatorStack(loadScopedForexIndicators(selected, activeTf));
  }, [selected, activeTf]);

  useEffect(() => {
    saveScopedForexIndicators(selected, activeTf, indicatorStack);
  }, [indicatorStack, selected, activeTf]);

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

  const liveBid = quote ? Number(quote.bid) : NaN;
  const liveAsk = quote ? Number(quote.ask) : NaN;
  const chartQuote =
    Number.isFinite(liveBid) && Number.isFinite(liveAsk) && liveAsk >= liveBid
      ? { bid: liveBid, ask: liveAsk }
      : quoteOverlay?.overlay
        ? { bid: quoteOverlay.bid, ask: quoteOverlay.ask }
        : null;

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

  const period = Number.isFinite(studyPeriod) && studyPeriod >= 2 ? Math.min(Math.floor(studyPeriod), 400) : 20;
  const slowPeriod = Math.max(period + 1, Math.round(period * 2.5));

  const registryOverlayBundle = useMemo(() => {
    const palette = [
      'rgba(96,165,250,0.85)',
      'rgba(245,184,0,0.85)',
      'rgba(52,211,153,0.8)',
      'rgba(167,139,250,0.8)',
    ];
    type Pt = { time: number; value: number };
    const toOverlay = (pts: Pt[]) => pts.map((p) => ({ time: p.time, value: p.value }));
    let primary: Pt[] = [];
    let secondary: Pt[] = [];
    let bands: { upper: Pt[]; lower: Pt[] } | undefined;
    const extras: Array<{ color: string; points: Pt[] }> = [];
    const rows = indicatorStack.filter((r) => r.enabled && getForexIndicatorDefinition(r.id)?.pane === 'overlay');
    for (const row of rows) {
      const def = getForexIndicatorDefinition(row.id);
      if (!def) continue;
      const { lines } = def.compute(bars, row.params);
      if (row.id === 'bb') {
        const upper = lines.find((l) => l.id === 'upper')?.points ?? [];
        const lower = lines.find((l) => l.id === 'lower')?.points ?? [];
        const mid = lines.find((l) => l.id === 'mid')?.points ?? [];
        bands = { upper: toOverlay(upper), lower: toOverlay(lower) };
        if (mid.length) primary = toOverlay(mid);
        continue;
      }
      for (const line of lines) {
        const pts = toOverlay(line.points);
        if (!pts.length) continue;
        if (!primary.length) primary = pts;
        else if (!secondary.length) secondary = pts;
        else extras.push({ color: palette[extras.length % palette.length]!, points: pts });
      }
    }
    return { active: rows.length > 0, primary, secondary, bands, extras };
  }, [indicatorStack, bars]);

  const legacyOverlay = useMemo(() => {
    if (study === 'sma20') return sma(bars, period);
    if (study === 'ema20' || study === 'ema20_50') return ema(bars, period);
    if (study === 'wma20') return wma(bars, period);
    if (study === 'hma21') return hma(bars, period);
    if (study === 'bb20') return bollinger(bars, period, 2).mid;
    if (study === 'supertrend') return supertrend(bars);
    return [];
  }, [bars, study, period]);
  const legacyOverlaySecondary = useMemo(
    () => (study === 'ema20_50' ? ema(bars, slowPeriod) : []),
    [bars, study, slowPeriod]
  );
  const legacyBands = useMemo(() => (study === 'bb20' ? bollinger(bars, period, 2) : undefined), [bars, study, period]);
  const overlay = registryOverlayBundle.active ? registryOverlayBundle.primary : legacyOverlay;
  const overlaySecondary = registryOverlayBundle.active ? registryOverlayBundle.secondary : legacyOverlaySecondary;
  const bands = registryOverlayBundle.active ? registryOverlayBundle.bands : legacyBands;
  const studyReady = study === 'none' || overlay.length > 0;
  const rsiSeries = useMemo(() => rsi(bars, 14), [bars]);
  const macdLine = useMemo(() => macdSeries(bars).macd, [bars]);

  const oscillatorPanes = useMemo((): OscillatorPaneSpec[] => {
    const lineColor = (id: string, idx: number) => {
      const map: Record<string, string> = {
        rsi: 'rgba(245,184,0,0.9)',
        macd: 'rgba(96,165,250,0.9)',
        signal: 'rgba(245,184,0,0.75)',
        hist: 'rgba(148,163,184,0.55)',
        k: 'rgba(96,165,250,0.9)',
        d: 'rgba(245,184,0,0.8)',
      };
      return map[id] ?? `hsl(${(idx * 53) % 360} 65% 58%)`;
    };
    const panes: OscillatorPaneSpec[] = [];
    for (const row of indicatorStack.filter((r) => r.enabled)) {
      const def = getForexIndicatorDefinition(row.id);
      if (!def || def.pane !== 'oscillator') continue;
      const { lines } = def.compute(bars, row.params);
      if (lines.every((l) => l.points.length === 0)) continue;
      panes.push({
        key: `${row.id}-${JSON.stringify(row.params)}`,
        label: def.name,
        series: lines.map((l, idx) => ({
          id: l.id,
          color: lineColor(l.id, idx),
          points: l.points.map((p) => ({ time: p.time, value: p.value })),
        })),
        referenceLines:
          row.id === 'rsi'
            ? [
                { value: 70, color: 'rgba(244,63,94,0.35)' },
                { value: 30, color: 'rgba(34,197,94,0.35)' },
              ]
            : row.id === 'stochastic'
              ? [
                  { value: 80, color: 'rgba(244,63,94,0.3)' },
                  { value: 20, color: 'rgba(34,197,94,0.3)' },
                ]
              : undefined,
      });
    }
    return panes;
  }, [indicatorStack, bars]);
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

  const draggablePendingLines = useMemo(
    () => buildDraggablePendingLines(orders, selected),
    [orders, selected]
  );

  const orderOverlays = useMemo(() => {
    const out: Array<{ price: number; title: string }> = [];
    for (const o of Object.values(orders)) {
      if (o.symbol !== selected) continue;
      const st = String(o.status ?? '').toUpperCase();
      if (!FOREX_CHART_PENDING_STATUSES.has(st)) continue;
      const isPendingType = o.type === 'limit' || o.type === 'stop' || o.type === 'stop_limit';
      if (!isPendingType) {
        const price = Number(o.requestedPrice);
        if (Number.isFinite(price) && price > 0) {
          out.push({ price, title: `${o.side.toUpperCase()} ${String(o.type).toUpperCase()}` });
        }
      }
      const sl = Number(o.stopLoss);
      if (Number.isFinite(sl) && sl > 0) out.push({ price: sl, title: `PENDING SL` });
      const tp = Number(o.takeProfit);
      if (Number.isFinite(tp) && tp > 0) out.push({ price: tp, title: `PENDING TP` });
    }
    for (const p of Object.values(positions)) {
      if (p.symbol !== selected || p.status !== 'OPEN') continue;
      const entry = Number(p.averageEntryPrice || p.entryPrice);
      if (Number.isFinite(entry) && entry > 0) {
        out.push({ price: entry, title: `${p.side === 'long' ? 'BUY' : 'SELL'} OPEN` });
      }
    }
    for (const pr of Object.values(protections)) {
      if (pr.symbol !== selected || pr.status !== 'ACTIVE') continue;
      const px = Number(pr.triggerPrice);
      if (!Number.isFinite(px) || px <= 0) continue;
      out.push({ price: px, title: pr.type === 'STOP_LOSS' ? 'SL' : 'TP' });
    }
    return out;
  }, [orders, positions, protections, selected]);

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
    const delta = Math.abs(b - a);
    const parts = [
      pips != null ? `${(b >= a ? '+' : '-')}${pips.toFixed(1)} pips` : null,
      pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : null,
      barsCount != null ? `${barsCount} bars` : null,
      delta > 0 ? `${delta.toFixed(Math.min(5, digits))} Δ` : '0 Δ',
    ].filter(Boolean);
    return parts.join(' · ') || null;
  }, [measurePoints, pipSize, bars]);

  const positionMode = useForexStore((s) => s.account?.positionMode ?? 'NETTING');
  const chartFocusPositionId = useForexWorkspaceStore((s) => s.chartFocusPositionId);
  const openPosition = useMemo(
    () => chartLinkedOpenPosition(positions, selected, positionMode, chartFocusPositionId),
    [positions, selected, positionMode, chartFocusPositionId]
  );

  const levels = useMemo(() => {
    if (!openPosition) return undefined;
    const prot = activeProtectionsFor(protections, openPosition.positionId);
    const entry = Number(openPosition.averageEntryPrice || openPosition.entryPrice);
    const entryOk = Number.isFinite(entry) && entry > 0;
    const sl = prot.sl ? Number(prot.sl.triggerPrice) : undefined;
    const tp = prot.tp ? Number(prot.tp.triggerPrice) : undefined;
    // Ghost levels give an unprotected position something to grab: dragging one
    // creates the protection instead of updating it.
    const ghost = (pips: number) =>
      entryOk ? entry + (openPosition.side === 'long' ? -pips : pips) * pipSize : undefined;
    return {
      entry: entryOk ? entry : undefined,
      sl: sl != null && Number.isFinite(sl) ? sl : undefined,
      tp: tp != null && Number.isFinite(tp) ? tp : undefined,
      slGhost: ghost(20),
      tpGhost: ghost(-40),
    };
  }, [openPosition, protections, pipSize]);

  const levelDragEnabled = Boolean(openPosition) && chartAuthed;
  const pendingDragEnabled = draggablePendingLines.length > 0 && chartAuthed && !orderEngine.busy;

  const commitPendingOrderDrag = useCallback(
    async (payload: {
      orderId: string;
      field: 'requestedPrice' | 'limitPrice';
      price: string;
      title: string;
    }): Promise<boolean> => {
      if (!chartAuthed) {
        setProtectionNote('Pending modify not sent — sign in.');
        return false;
      }
      const order = orders[payload.orderId];
      if (!order) {
        setProtectionNote('Order no longer on chart — refresh.');
        return false;
      }
      const label = payload.field === 'limitPrice' ? 'Limit price' : 'Trigger price';
      const ok = window.confirm(`Modify ${payload.title}\n${label} → ${payload.price}?`);
      if (!ok) {
        setProtectionNote('Pending modify cancelled.');
        return false;
      }
      setProtectionNote(`${payload.title} → ${payload.price} · sending modify…`);
      const patch =
        payload.field === 'limitPrice'
          ? { limitPrice: payload.price, expectedVersion: order.version }
          : { requestedPrice: payload.price, expectedVersion: order.version };
      const res = await orderEngine.modify(payload.orderId, patch);
      if (!res.ok) {
        setProtectionNote(res.error.message);
        return false;
      }
      setProtectionNote(`Modified ${payload.title} @ ${payload.price}`);
      return true;
    },
    [chartAuthed, orders, orderEngine]
  );

  /**
   * Chart SL/TP drag commit. The drag is only a preview — the level shown on the
   * chart is whatever the protection store reports after the server responds.
   */
  const commitProtectionDrag = useCallback(
    async (type: ForexProtectionType, price: string): Promise<boolean> => {
      const label = type === 'STOP_LOSS' ? 'SL' : 'TP';
      if (!openPosition) {
        setProtectionNote(`${label} not applied — no open ${selected} position.`);
        return false;
      }
      if (!chartAuthed) {
        setProtectionNote(`${label} not applied — sign in to modify protections.`);
        return false;
      }
      const px = Number(price);
      if (!Number.isFinite(px) || px <= 0) {
        setProtectionNote(`${label} not applied — invalid price.`);
        return false;
      }
      const long = openPosition.side === 'long';
      // A long exits on the bid, a short on the ask; fall back to entry if no quote.
      const exit = quote ? Number(long ? quote.bid : quote.ask) : NaN;
      const mark =
        Number.isFinite(exit) && exit > 0 ? exit : Number(openPosition.averageEntryPrice || openPosition.entryPrice);
      if (Number.isFinite(mark) && mark > 0) {
        const wantAbove = long ? type === 'TAKE_PROFIT' : type === 'STOP_LOSS';
        if (px === mark || (px > mark) !== wantAbove) {
          setProtectionNote(
            `${label} rejected — a ${long ? 'long' : 'short'} ${label} must sit ${wantAbove ? 'above' : 'below'} ${fxNum(mark, digits)}.`
          );
          return false;
        }
      }
      const current = activeProtectionsFor(protections, openPosition.positionId)[
        type === 'STOP_LOSS' ? 'sl' : 'tp'
      ];
      setProtectionNote(`${label} → ${fxNum(price, digits)} · sending to server…`);
      const ok = current
        ? await positionActions.updateProtection(openPosition, type, current.protectionId, price)
        : await positionActions.createProtection(openPosition, type, price);
      setProtectionNote(
        ok
          ? `${label} confirmed by server at ${fxNum(price, digits)}.`
          : `${label} rejected by server — level reverted to the last confirmed price.`
      );
      return ok;
    },
    [openPosition, chartAuthed, quote, protections, positionActions, selected, digits]
  );

  const quoteFreshness =
    connection === 'DISCONNECTED' || connection === 'CONNECTING' || connection === 'RECONNECTING'
      ? 'DISCONNECTED'
      : connection === 'STALE' || staleQuote
        ? 'STALE'
        : quote
          ? 'LIVE'
          : 'LOADING';

  const quoteModeLabel =
    quoteFreshness === 'LOADING'
      ? 'CONNECTING'
      : quoteFreshness === 'DISCONNECTED'
        ? 'UNAVAILABLE'
        : quoteFreshness === 'STALE'
          ? 'STALE · DEMO'
          : 'DEMO · SIMULATED';

  const refreshObjectRows = useCallback(() => {
    const list = chartApiRef.current?.listDrawingObjects() ?? [];
    setObjectRows(objectRowsFromApi(list));
  }, []);

  const onPickTool = useCallback(
    (t: ForexAnalysisTool) => {
      analysisToolRef.current = t;
      setTool(t);
      if (t === 'rr') setRrPoints([]);
      if (t === 'measure') setMeasurePoints([]);
      chartApiRef.current?.setTool(t);
    },
    []
  );

  const ohlcCompact =
    ohlcDisplay && !props?.compactChrome
      ? `O ${fxNum(String(ohlcDisplay.open), digits)} H ${fxNum(String(ohlcDisplay.high), digits)} L ${fxNum(String(ohlcDisplay.low), digits)} C ${fxNum(String(ohlcDisplay.close), digits)}`
      : null;

  const onPricePick = useCallback(
    (price: number, time: number | null) => {
      const activeTool = analysisToolRef.current;
      if (activeTool === 'alert') {
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
      if (activeTool === 'measure') {
        setMeasurePoints((cur) => {
          if (cur.length >= 2) return [{ price, time }];
          return [...cur, { price, time }];
        });
        return;
      }
      if (activeTool === 'rr') {
        setRrPoints((cur) => {
          if (cur.length >= 3) return [price];
          return [...cur, price];
        });
      }
    },
    [selected, lastClose]
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
  // The executable quote and the reference candle series must share one price
  // universe. Surface any drift instead of letting the chart imply a stale price.
  if (quoteOverlay?.overlay && !quoteOverlay.aligned && lastClose != null) {
    const relPct = (Math.abs((quoteOverlay.bid + quoteOverlay.ask) / 2 - lastClose) / lastClose) * 100;
    banners.push({
      tone: 'warn',
      text: `Live quote is ${relPct.toFixed(2)}% away from the reference candle series. The executable price is the Live quote, not the candle close.`,
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
  if (tool === 'channel') {
    banners.push({
      tone: 'neutral',
      text: 'Channel (LOCAL): click two points for the base line, then a third to set the channel width.',
    });
  }
  if (tool === 'fibext') {
    banners.push({
      tone: 'neutral',
      text: 'Fib Extension (LOCAL): click swing A, then B, then the retracement point C — 127.2 / 161.8 / 200 / 261.8 project from C.',
    });
  }
  if (tool === 'sr') {
    banners.push({ tone: 'neutral', text: 'S/R (LOCAL): click a price to drop a labelled support/resistance level.' });
  }
  if (tool === 'text') {
    banners.push({ tone: 'neutral', text: 'Text (LOCAL): click the chart, then type the annotation.' });
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
    if (!props?.showOneClick || !chartAuthed || orderEngine.busy) return;
    void orderEngine.place({
      symbol: selected,
      side: 'buy',
      orderType: 'market',
      volume: inst?.minVolume ?? '0.01',
    });
  };
  const oneClickSell = () => {
    if (!props?.showOneClick || !chartAuthed || orderEngine.busy) return;
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
      aria-label={tc('marketChartAria')}
      onMouseDown={activate}
    >
      {!props?.compactChrome ? (
        <ForexMt5ChartChrome
          symbolLabel={inst?.displaySymbol ?? selected}
          activeTf={activeTf}
          timeframes={timeframes}
          onTf={setTf}
          digits={digits}
          bid={quote?.bid}
          ask={quote?.ask}
          spreadPips={quote?.spreadPips}
          demoSecondary={quote ? quoteModeLabel : tc('loadingQuote')}
          chartType={chartType}
          onChartType={setChartType}
          indicatorStack={indicatorStack}
          onAddIndicator={addRegistryIndicator}
          onRemoveIndicator={removeRegistryIndicator}
          onUpdateIndicatorParam={updateRegistryIndicatorParam}
          showCalendar={showCalendar}
          onCalendar={(v) => {
            setShowCalendar(v);
            if (v) setShowIntel(false);
          }}
          showObjects={objectsPanelOpen}
          onObjects={() => {
            setObjectsPanelOpen((o) => {
              const next = !o;
              if (next) refreshObjectRows();
              return next;
            });
          }}
          onZoomIn={() => chartApiRef.current?.zoomIn()}
          onZoomOut={() => chartApiRef.current?.zoomOut()}
          onExpand={!embedded && !props?.instanceId ? () => setChartMode(chartMode === 'expand' ? 'normal' : 'expand') : undefined}
          onFullscreen={!embedded && !props?.instanceId ? () => setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen') : undefined}
          expandActive={chartMode === 'expand'}
          fullscreenActive={chartMode === 'fullscreen'}
          compact={props?.compactChrome}
          showOneClick={props?.showOneClick}
          oneClickBuy={oneClickBuy}
          oneClickSell={oneClickSell}
          oneClickDisabled={orderEngine.busy || !chartAuthed}
          ohlcLine={ohlcCompact}
          showDataWindow={dataWindowOpen}
          onDataWindow={() => setDataWindowOpen((v) => !v)}
        />
      ) : (
        <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2 font-mono text-[11px]">
          <span className="font-semibold">{inst?.displaySymbol ?? selected}</span>
          <span className="text-muted-foreground">{activeTf}</span>
        </div>
      )}
      {props?.showOneClick && orderEngine.lastNote ? (
        <p className="border-b border-border px-2 py-0.5 text-[10px] text-muted-foreground">{orderEngine.lastNote}</p>
      ) : null}
      {protectionNote ? (
        <p role="status" className="border-b border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {protectionNote}
          {positionActions.actionError ? ` ${positionActions.actionError.message}` : ''}
        </p>
      ) : null}

      <div className={cn('flex min-h-0 flex-1', embedded && 'min-h-[280px]')}>
        {!props?.compactChrome ? (
          <ForexMt5DrawingRail
            tool={tool}
            onTool={onPickTool}
            objectsOpen={objectsPanelOpen}
            onObjects={() => {
              setObjectsPanelOpen((o) => {
                const next = !o;
                if (next) refreshObjectRows();
                return next;
              });
            }}
            measureSummary={measureSummary}
          />
        ) : null}
        <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col')}>
        <ForexLightweightChart
          candles={candleView.status === 'READY' ? candleView.candles : []}
          quote={chartQuote}
          dark={dark}
          canvasLight={!embedded}
          digits={digits}
          chartType={chartType}
          overlay={overlay}
          overlaySecondary={overlaySecondary}
          bands={bands}
          overlayExtras={registryOverlayBundle.extras}
          levels={levels}
          structureLevels={structureLevels}
          alertPrices={alertPrices}
          rrLevels={rrLevels}
          showSessions={showSessions}
          showRsi={false}
          rsi={rsiSeries}
          showMacd={false}
          macd={macdLine}
          oscillatorPanes={oscillatorPanes}
          orderOverlays={orderOverlays}
          calendarMarkers={calendarMarkers}
          tool={tool}
          hideDrawings={!showDrawings}
          drawingsKey={`eda-forex-drawings:${props?.instanceId ?? 'main'}:${selected}:${activeTf}`}
          levelDrag={levelDragEnabled}
          onDragSl={(price) => commitProtectionDrag('STOP_LOSS', price)}
          onDragTp={(price) => commitProtectionDrag('TAKE_PROFIT', price)}
          pendingDrag={pendingDragEnabled}
          draggablePendingLines={draggablePendingLines}
          onDragPendingLine={(p) => commitPendingOrderDrag(p)}
          onCrosshair={setCrosshair}
          onPricePick={onPricePick}
          onContextMenuPrice={(price, time, x, y) => setCtxMenu({ price, time, x, y })}
          onDrawingsChanged={refreshObjectRows}
          onApi={(api) => {
            chartApiRef.current = api;
            if (api && objectsPanelOpen) refreshObjectRows();
          }}
        />
        <ForexMt5DataWindow
          open={dataWindowOpen && !props?.compactChrome && candleView.status === 'READY'}
          digits={digits}
          ohlc={
            ohlcDisplay
              ? {
                  open: Number(ohlcDisplay.open),
                  high: Number(ohlcDisplay.high),
                  low: Number(ohlcDisplay.low),
                  close: Number(ohlcDisplay.close),
                  time: ohlcDisplay.time ?? undefined,
                }
              : null
          }
          spreadPips={quote?.spreadPips ?? null}
          indicators={hoverIndicators}
        />
        <ForexMt5ObjectsPanel
          open={objectsPanelOpen && !props?.compactChrome}
          onClose={() => setObjectsPanelOpen(false)}
          rows={objectRows}
          onRefresh={refreshObjectRows}
          onClearAll={() => {
            chartApiRef.current?.clearDrawings();
            refreshObjectRows();
          }}
          onSelect={(row) => {
            chartApiRef.current?.selectDrawingObject(row.id, row.layer);
          }}
          onDelete={(row) => {
            if (chartApiRef.current?.deleteDrawingObject(row.id, row.layer)) refreshObjectRows();
          }}
          onToggleHidden={(row) => {
            const next = !row.hidden;
            if (chartApiRef.current?.setDrawingObjectHidden(row.id, row.layer, next)) refreshObjectRows();
          }}
          onToggleLocked={(row) => {
            const next = !row.locked;
            if (chartApiRef.current?.setDrawingObjectLocked(row.id, row.layer, next)) refreshObjectRows();
          }}
        />
        {candleView.status === 'NO_HISTORY' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-border bg-card/95 p-4 text-center shadow-lg">
              <p className="text-sm font-medium text-foreground">{tc('noHistoricalTitle')}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {tc('noHistoricalBody', { symbol: inst?.displaySymbol ?? selected, timeframe: activeTf })}
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
              label="Market BUY (ASK)"
              onClick={() => {
                setPanel('ticket', true);
                setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Market SELL (BID)"
              onClick={() => {
                setPanel('ticket', true);
                setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'sell' });
                setCtxMenu(null);
              }}
            />
            <CtxItem
              label="Trade from price (limit)"
              onClick={() => {
                setPanel('ticket', true);
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
                  label={`Buy Limit @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'limit',
                      side: 'buy',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Buy Stop @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'stop',
                      side: 'buy',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Sell Limit @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'limit',
                      side: 'sell',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Sell Stop @ ${fxNum(ctxMenu.price, digits)}`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'stop',
                      side: 'sell',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Buy Stop Limit @ ${fxNum(ctxMenu.price, digits)} (set limit on ticket)`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'stop_limit',
                      side: 'buy',
                    });
                    setCtxMenu(null);
                  }}
                />
                <CtxItem
                  label={`Sell Stop Limit @ ${fxNum(ctxMenu.price, digits)} (set limit on ticket)`}
                  onClick={() => {
                    setPanel('ticket', true);
                    setTicketDraft({
                      nonce: Date.now(),
                      price: String(ctxMenu.price),
                      orderType: 'stop_limit',
                      side: 'sell',
                    });
                    setCtxMenu(null);
                  }}
                />
              </>
            ) : null}
            {(() => {
              const near = Object.values(orders).find((o) => {
                const st = String(o.status).toUpperCase();
                if (o.symbol !== selected || !['ACCEPTED', 'PENDING', 'NEW', 'WORKING', 'OPEN'].includes(st)) return false;
                const px = Number(o.requestedPrice);
                return Number.isFinite(px) && Math.abs(px - ctxMenu.price) <= Math.pow(10, -(digits - 1));
              });
              if (!near) return null;
              return (
                <>
                  <CtxItem
                    label={`Pending ${near.orderId.slice(0, 8)} · ${near.type} ${near.requestedVolume}`}
                    onClick={() => {
                      setBottomTab('orders');
                      setCtxMenu(null);
                    }}
                  />
                  <CtxItem
                    label="Cancel pending (server)"
                    onClick={() => {
                      void orderEngine.cancel(near.orderId);
                      setCtxMenu(null);
                    }}
                  />
                </>
              );
            })()}
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
        {showCalendar && !props?.compactChrome ? (
          <ForexMt5EventStrip events={calendarForSymbol} available={calendarMeta.available} reason={calendarMeta.reason} />
        ) : null}
        </div>
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
