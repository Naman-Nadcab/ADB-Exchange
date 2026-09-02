'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, IPriceLine, ISeriesApi, MouseEventParams, UTCTimestamp } from 'lightweight-charts';
import type { DrawingToolMode } from '@/components/trade/chart/extension/types';
import { DrawingToolManager } from '@/components/trade/chart/tools/DrawingToolManager';
import type { ForexCandle } from '@/lib/forex/models/candles';
import { candleTimeMs } from '@/lib/forex/models/candles';
import type { StructureLevel } from '@/lib/forex/chart/structure-levels';
import { buildSessionBoundaries } from '@/lib/forex/chart/session-markers';
import { ForexDrawingEngine, type ForexExtraTool, type ForexSerializedExtra } from '@/lib/forex/chart/forex-drawings';
import { getDomChartThemeOptions, getTradingChartColors } from '@/components/trade/chart/cssTradingColors';
import type { ForexAnalysisTool } from './ForexChartToolbar';

export type ForexChartType = 'candle' | 'line' | 'area' | 'ohlc';

type QuoteLevels = { bid: number; ask: number } | null;
type ProtectionLevels = { entry?: number; sl?: number; tp?: number };
type OverlayPoint = { time: number; value: number };
type RrLevels = { entry: number; stop: number; target: number } | null;
type OrderOverlay = { price: number; title: string };
type CalendarMarker = { time: number; text: string };

export type ForexChartCrosshair = {
  time: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  price: number | null;
};

export type ForexChartApi = {
  setTool: (tool: ForexAnalysisTool) => void;
  clearDrawings: () => void;
  serializeDrawings: () => unknown[];
};

function toBars(candles: ForexCandle[]) {
  const out: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
  const seen = new Set<number>();
  for (const c of candles) {
    const ms = candleTimeMs(c.timestamp);
    if (ms == null) continue;
    const time = Math.floor(ms / 1000);
    if (seen.has(time)) continue;
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
    seen.add(time);
    out.push({ time: time as UTCTimestamp, open, high, low, close });
  }
  return out;
}

function lineOpts(price: number, color: string, title: string) {
  return { price, color, lineWidth: 1 as const, axisLabelVisible: true, title, lineStyle: 2 as const };
}

function minMove(digits: number): number {
  return Number(`1e-${Math.max(0, Math.min(digits, 8))}`);
}

const LEVEL_COLORS: Record<string, string> = {
  DO: 'rgba(245,184,0,0.55)',
  WO: 'rgba(245,184,0,0.4)',
  MO: 'rgba(245,184,0,0.3)',
  PDH: 'rgba(34,197,94,0.55)',
  PDL: 'rgba(244,63,94,0.55)',
  PWH: 'rgba(34,197,94,0.35)',
  PWL: 'rgba(244,63,94,0.35)',
};

export function ForexLightweightChart(props: {
  candles: ForexCandle[];
  quote: QuoteLevels;
  dark: boolean;
  digits?: number;
  chartType?: ForexChartType;
  overlay?: OverlayPoint[];
  overlaySecondary?: OverlayPoint[];
  bands?: { upper: OverlayPoint[]; lower: OverlayPoint[] };
  levels?: ProtectionLevels;
  structureLevels?: StructureLevel[];
  alertPrices?: number[];
  rrLevels?: RrLevels;
  showSessions?: boolean;
  showRsi?: boolean;
  rsi?: OverlayPoint[];
  showMacd?: boolean;
  macd?: OverlayPoint[];
  orderOverlays?: OrderOverlay[];
  calendarMarkers?: CalendarMarker[];
  tool?: ForexAnalysisTool;
  hideDrawings?: boolean;
  drawingsKey?: string;
  onCrosshair?: (state: ForexChartCrosshair) => void;
  onPricePick?: (price: number, time: number | null) => void;
  onContextMenuPrice?: (price: number, time: number | null, clientX: number, clientY: number) => void;
  onApi?: (api: ForexChartApi | null) => void;
  onDrawingsChanged?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const rsiHostRef = useRef<HTMLDivElement | null>(null);
  const macdHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'> | null>(
    null
  );
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const seriesKindRef = useRef<ForexChartType>('candle');
  const drawRef = useRef<DrawingToolManager | null>(null);
  const extraDrawRef = useRef<ForexDrawingEngine | null>(null);
  const overlayRef = useRef<ISeriesApi<'Line'> | null>(null);
  const overlay2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const upperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bidRef = useRef<IPriceLine | null>(null);
  const askRef = useRef<IPriceLine | null>(null);
  const lastRef = useRef<IPriceLine | null>(null);
  const entryRef = useRef<IPriceLine | null>(null);
  const slRef = useRef<IPriceLine | null>(null);
  const tpRef = useRef<IPriceLine | null>(null);
  const structureLinesRef = useRef<IPriceLine[]>([]);
  const alertLinesRef = useRef<IPriceLine[]>([]);
  const rrLinesRef = useRef<IPriceLine[]>([]);
  const orderLinesRef = useRef<IPriceLine[]>([]);
  const quoteRef = useRef(props.quote);
  const candlesRef = useRef(props.candles);
  const digitsRef = useRef(props.digits ?? 5);
  const chartTypeRef = useRef<ForexChartType>(props.chartType ?? 'candle');
  const onCrosshairRef = useRef(props.onCrosshair);
  const onPricePickRef = useRef(props.onPricePick);
  const onContextMenuRef = useRef(props.onContextMenuPrice);
  const toolRef = useRef(props.tool ?? 'none');
  const showSessionsRef = useRef(Boolean(props.showSessions));
  const calendarRef = useRef(props.calendarMarkers ?? []);
  quoteRef.current = props.quote;
  candlesRef.current = props.candles;
  digitsRef.current = props.digits ?? 5;
  chartTypeRef.current = props.chartType ?? 'candle';
  onCrosshairRef.current = props.onCrosshair;
  onPricePickRef.current = props.onPricePick;
  onContextMenuRef.current = props.onContextMenuPrice;
  toolRef.current = props.tool ?? 'none';
  showSessionsRef.current = Boolean(props.showSessions);
  calendarRef.current = props.calendarMarkers ?? [];

  useEffect(() => {
    const el = hostRef.current;
    const overlayHost = overlayHostRef.current;
    if (!el || !overlayHost) return;
    let disposed = false;
    const colors = getTradingChartColors();
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');
    const digits = digitsRef.current;
    const gridColor = props.dark ? 'rgba(245,184,0,0.06)' : 'rgba(15,23,42,0.06)';
    const gridVert = props.dark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.05)';

    void import('lightweight-charts').then((lwc) => {
      if (disposed || !hostRef.current || !overlayHostRef.current) return;
      const chart = lwc.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: theme.layout.background.color },
          textColor: theme.layout.textColor,
          fontSize: 11,
        },
        grid: {
          vertLines: { color: gridVert, style: lwc.LineStyle.Solid },
          horzLines: { color: gridColor, style: lwc.LineStyle.Solid },
        },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
          vertLine: {
            color: props.dark ? 'rgba(245,184,0,0.45)' : 'rgba(15,23,42,0.35)',
            width: 1,
            style: lwc.LineStyle.Dashed,
            labelBackgroundColor: props.dark ? '#1a1f2b' : '#e5e7eb',
          },
          horzLine: {
            color: props.dark ? 'rgba(245,184,0,0.45)' : 'rgba(15,23,42,0.35)',
            width: 1,
            style: lwc.LineStyle.Dashed,
            labelBackgroundColor: props.dark ? '#1a1f2b' : '#e5e7eb',
          },
        },
        rightPriceScale: {
          borderColor: theme.rightPriceScale.borderColor,
          entireTextOnly: true,
          scaleMargins: { top: 0.06, bottom: 0.08 },
        },
        timeScale: {
          borderColor: theme.timeScale.borderColor,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 4,
          barSpacing: 8,
          minBarSpacing: 3,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      });

      const priceFormat = { type: 'price' as const, precision: digits, minMove: minMove(digits) };
      const autoscaleInfoProvider = (original: () => unknown) => {
        const base = original() as { priceRange?: { minValue: number; maxValue: number } } | null;
        const q = quoteRef.current;
        const bars = toBars(candlesRef.current);
        if (bars.length > 0) {
          let lo = Infinity;
          let hi = -Infinity;
          for (const b of bars) {
            lo = Math.min(lo, b.low);
            hi = Math.max(hi, b.high);
          }
          if (q) {
            lo = Math.min(lo, q.bid, q.ask);
            hi = Math.max(hi, q.bid, q.ask);
          }
          const span = Math.max(hi - lo, minMove(digitsRef.current) * 20);
          const pad = span * 0.1;
          return { priceRange: { minValue: lo - pad, maxValue: hi + pad } };
        }
        if (!q) return base;
        const mid = (q.bid + q.ask) / 2;
        const pad = Math.max(Math.abs(mid) * 0.0008, (q.ask - q.bid) * 20, minMove(digitsRef.current) * 50);
        return { priceRange: { minValue: mid - pad, maxValue: mid + pad } };
      };

      const kind = chartTypeRef.current;
      let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>;
      if (kind === 'line') {
        series = chart.addLineSeries({
          color: 'rgba(245,184,0,0.95)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat,
          autoscaleInfoProvider,
        });
      } else if (kind === 'area') {
        series = chart.addAreaSeries({
          lineColor: 'rgba(245,184,0,0.95)',
          topColor: 'rgba(245,184,0,0.28)',
          bottomColor: 'rgba(245,184,0,0.02)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat,
          autoscaleInfoProvider,
        });
      } else if (kind === 'ohlc') {
        series = chart.addBarSeries({
          upColor: colors.up,
          downColor: colors.down,
          thinBars: false,
          openVisible: true,
          priceFormat,
          autoscaleInfoProvider,
        });
      } else {
        series = chart.addCandlestickSeries({
          upColor: colors.up,
          downColor: colors.down,
          borderVisible: true,
          borderUpColor: colors.up,
          borderDownColor: colors.down,
          wickUpColor: colors.up,
          wickDownColor: colors.down,
          priceFormat,
          autoscaleInfoProvider,
        });
      }

      chartRef.current = chart;
      seriesRef.current = series;
      seriesKindRef.current = kind;
      overlayRef.current = chart.addLineSeries({
        color: 'rgba(245,184,0,0.9)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat,
      });
      overlay2Ref.current = chart.addLineSeries({
        color: 'rgba(96,165,250,0.85)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat,
      });
      upperRef.current = chart.addLineSeries({
        color: 'rgba(156,163,175,0.55)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat,
      });
      lowerRef.current = chart.addLineSeries({
        color: 'rgba(156,163,175,0.55)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat,
      });

      const bars = toBars(candlesRef.current);
      applySeriesData(series, kind, bars);
      if (bars.length) chart.timeScale().fitContent();
      applySessionMarkers(series, bars, showSessionsRef.current, calendarRef.current);

      // Reuse Crypto drawing manager (read-only import) — Forex overlay host only.
      try {
        const mgr = new DrawingToolManager(chart, series as ISeriesApi<'Candlestick'>, overlayHostRef.current);
        drawRef.current = mgr;
        if (props.drawingsKey) {
          try {
            const raw = localStorage.getItem(props.drawingsKey);
            if (raw) mgr.loadSerializedDrawings(JSON.parse(raw));
          } catch {
            /* ignore */
          }
          mgr.setMutateCallback(() => {
            try {
              localStorage.setItem(props.drawingsKey!, JSON.stringify(mgr.serializeDrawings()));
            } catch {
              /* ignore */
            }
            props.onDrawingsChanged?.();
          });
        }
      } catch {
        drawRef.current = null;
      }

      try {
        const extra = new ForexDrawingEngine(chart, series, overlayHostRef.current);
        extraDrawRef.current = extra;
        if (props.drawingsKey) {
          try {
            const raw = localStorage.getItem(`${props.drawingsKey}:extra`);
            if (raw) extra.load(JSON.parse(raw) as ForexSerializedExtra[]);
          } catch {
            /* ignore */
          }
          extra.setMutateCallback(() => {
            try {
              localStorage.setItem(`${props.drawingsKey}:extra`, JSON.stringify(extra.serialize()));
            } catch {
              /* ignore */
            }
            props.onDrawingsChanged?.();
          });
        }
      } catch {
        extraDrawRef.current = null;
      }

      const q = quoteRef.current;
      if (q && 'createPriceLine' in series) {
        bidRef.current = series.createPriceLine(lineOpts(q.bid, colors.up, 'BID'));
        askRef.current = series.createPriceLine(lineOpts(q.ask, colors.down, 'ASK'));
      } else if (bars.length && 'createPriceLine' in series) {
        const last = bars[bars.length - 1].close;
        lastRef.current = series.createPriceLine(lineOpts(last, 'rgba(245,184,0,0.75)', 'CLOSE'));
      }

      chart.subscribeCrosshairMove((param: MouseEventParams) => {
        const cb = onCrosshairRef.current;
        if (!cb) return;
        if (!param.time || !param.seriesData.size) {
          cb({ time: null, open: null, high: null, low: null, close: null, price: null });
          return;
        }
        const raw = param.seriesData.get(series);
        const time = typeof param.time === 'number' ? param.time : null;
        if (!raw || typeof raw !== 'object') {
          cb({ time, open: null, high: null, low: null, close: null, price: null });
          return;
        }
        const row = raw as { open?: number; high?: number; low?: number; close?: number; value?: number };
        const close = row.close ?? row.value ?? null;
        cb({ time, open: row.open ?? null, high: row.high ?? null, low: row.low ?? null, close, price: close });
      });

      // Click pick for measure / RR / alert (when not in native draw modes)
      const onClick = (param: MouseEventParams) => {
        const tool = toolRef.current;
        if (tool !== 'measure' && tool !== 'rr' && tool !== 'alert') return;
        if (param.point == null) return;
        const price = series.coordinateToPrice(param.point.y);
        if (price == null || !Number.isFinite(price)) return;
        const time = typeof param.time === 'number' ? param.time : null;
        onPricePickRef.current?.(Number(price), time);
      };
      chart.subscribeClick(onClick);

      const onCtx = (ev: MouseEvent) => {
        ev.preventDefault();
        const rect = hostRef.current!.getBoundingClientRect();
        const y = ev.clientY - rect.top;
        const x = ev.clientX - rect.left;
        const price = series.coordinateToPrice(y);
        const tRaw = chart.timeScale().coordinateToTime(x);
        const time = typeof tRaw === 'number' ? tRaw : null;
        if (price != null && Number.isFinite(price)) {
          onContextMenuRef.current?.(Number(price), time, ev.clientX, ev.clientY);
        }
      };
      hostRef.current.addEventListener('contextmenu', onCtx);

      props.onApi?.({
        setTool: (tool) => {
          applyToolMode(tool, drawRef.current, extraDrawRef.current, toolRef);
        },
        clearDrawings: () => {
          drawRef.current?.clearAll();
          extraDrawRef.current?.clearAll();
          if (props.drawingsKey) {
            try {
              localStorage.removeItem(props.drawingsKey);
              localStorage.removeItem(`${props.drawingsKey}:extra`);
            } catch {
              /* ignore */
            }
          }
        },
        serializeDrawings: () => [
          ...(drawRef.current?.serializeDrawings() ?? []),
          ...(extraDrawRef.current?.serialize() ?? []),
        ],
      });
    });

    return () => {
      disposed = true;
      props.onApi?.(null);
      drawRef.current?.destroy();
      drawRef.current = null;
      extraDrawRef.current?.destroy();
      extraDrawRef.current = null;
      clearLines(structureLinesRef, seriesRef.current);
      clearLines(alertLinesRef, seriesRef.current);
      clearLines(rrLinesRef, seriesRef.current);
      clearLines(orderLinesRef, seriesRef.current);
      bidRef.current = null;
      askRef.current = null;
      lastRef.current = null;
      entryRef.current = null;
      slRef.current = null;
      tpRef.current = null;
      overlayRef.current = null;
      overlay2Ref.current = null;
      upperRef.current = null;
      lowerRef.current = null;
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      macdChartRef.current?.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dark, props.digits, props.chartType, props.drawingsKey]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const bars = toBars(props.candles);
    applySeriesData(series, seriesKindRef.current, bars);
    applySessionMarkers(series, bars, Boolean(props.showSessions), props.calendarMarkers ?? []);
    if (bars.length) chart.timeScale().fitContent();
  }, [props.candles, props.showSessions, props.calendarMarkers]);

  useEffect(() => {
    const map = (pts: OverlayPoint[]) =>
      pts
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    overlayRef.current?.setData(map(props.overlay ?? []));
    overlay2Ref.current?.setData(map(props.overlaySecondary ?? []));
    upperRef.current?.setData(map(props.bands?.upper ?? []));
    lowerRef.current?.setData(map(props.bands?.lower ?? []));
  }, [props.overlay, props.overlaySecondary, props.bands]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !('createPriceLine' in series)) return;
    const colors = getTradingChartColors();
    const apply = (
      ref: { current: IPriceLine | null },
      price: number | undefined,
      color: string,
      title: string
    ) => {
      if (price == null || !Number.isFinite(price) || price <= 0) {
        if (ref.current) series.removePriceLine(ref.current);
        ref.current = null;
        return;
      }
      if (!ref.current) ref.current = series.createPriceLine(lineOpts(price, color, title));
      else ref.current.applyOptions({ price, color, title });
    };
    if (!props.quote) {
      if (bidRef.current) series.removePriceLine(bidRef.current);
      if (askRef.current) series.removePriceLine(askRef.current);
      bidRef.current = null;
      askRef.current = null;
      const bars = toBars(candlesRef.current);
      const last = bars.length ? bars[bars.length - 1].close : undefined;
      apply(lastRef, last, 'rgba(245,184,0,0.75)', 'CLOSE');
    } else {
      if (lastRef.current) series.removePriceLine(lastRef.current);
      lastRef.current = null;
      apply(bidRef, props.quote.bid, colors.up, 'BID');
      apply(askRef, props.quote.ask, colors.down, 'ASK');
    }
    apply(entryRef, props.levels?.entry, 'rgba(245,184,0,0.85)', 'Entry');
    apply(slRef, props.levels?.sl, colors.down, 'SL');
    apply(tpRef, props.levels?.tp, colors.up, 'TP');
  }, [props.quote, props.levels, props.candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !('createPriceLine' in series)) return;
    clearLines(structureLinesRef, series);
    for (const lv of props.structureLevels ?? []) {
      structureLinesRef.current.push(
        series.createPriceLine(
          lineOpts(lv.price, LEVEL_COLORS[lv.id] ?? 'rgba(156,163,175,0.5)', lv.label)
        )
      );
    }
  }, [props.structureLevels, props.candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !('createPriceLine' in series)) return;
    clearLines(alertLinesRef, series);
    for (const price of props.alertPrices ?? []) {
      if (!Number.isFinite(price) || price <= 0) continue;
      alertLinesRef.current.push(
        series.createPriceLine(lineOpts(price, 'rgba(245,184,0,0.9)', '🔔 Alert'))
      );
    }
  }, [props.alertPrices]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !('createPriceLine' in series)) return;
    clearLines(rrLinesRef, series);
    const rr = props.rrLevels;
    if (!rr) return;
    rrLinesRef.current.push(series.createPriceLine(lineOpts(rr.entry, 'rgba(245,184,0,0.9)', 'RR Entry')));
    rrLinesRef.current.push(series.createPriceLine(lineOpts(rr.stop, 'rgba(244,63,94,0.9)', 'RR SL')));
    rrLinesRef.current.push(series.createPriceLine(lineOpts(rr.target, 'rgba(34,197,94,0.9)', 'RR TP')));
  }, [props.rrLevels]);

  useEffect(() => {
    applyToolMode(props.tool ?? 'none', drawRef.current, extraDrawRef.current, toolRef);
  }, [props.tool]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !('createPriceLine' in series)) return;
    clearLines(orderLinesRef, series);
    for (const o of props.orderOverlays ?? []) {
      if (!Number.isFinite(o.price) || o.price <= 0) continue;
      orderLinesRef.current.push(series.createPriceLine(lineOpts(o.price, 'rgba(245,184,0,0.7)', o.title)));
    }
  }, [props.orderOverlays]);

  // RSI pane
  useEffect(() => {
    const host = rsiHostRef.current;
    if (!host) return;
    if (!props.showRsi) {
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      host.replaceChildren();
      return;
    }
    let disposed = false;
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');
    void import('lightweight-charts').then((lwc) => {
      if (disposed || !rsiHostRef.current) return;
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      const chart = lwc.createChart(rsiHostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: theme.layout.background.color },
          textColor: theme.layout.textColor,
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.06)' },
          horzLines: { color: 'rgba(148,163,184,0.06)' },
        },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { visible: false, borderVisible: false },
        crosshair: { mode: lwc.CrosshairMode.Normal },
      });
      const series = chart.addLineSeries({
        color: 'rgba(245,184,0,0.9)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      });
      series.createPriceLine({ price: 70, color: 'rgba(244,63,94,0.35)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      series.createPriceLine({ price: 30, color: 'rgba(34,197,94,0.35)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      rsiChartRef.current = chart;
      rsiSeriesRef.current = series;
      const pts = (props.rsi ?? [])
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
      series.setData(pts);
      if (chartRef.current) {
        const sync = () => {
          const range = chartRef.current?.timeScale().getVisibleLogicalRange();
          if (range) chart.timeScale().setVisibleLogicalRange(range);
        };
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync);
        sync();
      }
    });
    return () => {
      disposed = true;
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [props.showRsi, props.dark]);

  useEffect(() => {
    if (!rsiSeriesRef.current) return;
    const pts = (props.rsi ?? [])
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    rsiSeriesRef.current.setData(pts);
  }, [props.rsi]);

  useEffect(() => {
    const host = macdHostRef.current;
    if (!host) return;
    if (!props.showMacd) {
      macdChartRef.current?.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
      host.replaceChildren();
      return;
    }
    let disposed = false;
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');
    void import('lightweight-charts').then((lwc) => {
      if (disposed || !macdHostRef.current) return;
      macdChartRef.current?.remove();
      const chart = lwc.createChart(macdHostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: theme.layout.background.color },
          textColor: theme.layout.textColor,
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.06)' },
          horzLines: { color: 'rgba(148,163,184,0.06)' },
        },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
        timeScale: { visible: false, borderVisible: false },
        crosshair: { mode: lwc.CrosshairMode.Normal },
      });
      const series = chart.addLineSeries({
        color: 'rgba(96,165,250,0.9)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
      });
      series.createPriceLine({ price: 0, color: 'rgba(148,163,184,0.35)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      macdChartRef.current = chart;
      macdSeriesRef.current = series;
      const pts = (props.macd ?? [])
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
      series.setData(pts);
      if (chartRef.current) {
        const sync = () => {
          const range = chartRef.current?.timeScale().getVisibleLogicalRange();
          if (range) chart.timeScale().setVisibleLogicalRange(range);
        };
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync);
        sync();
      }
    });
    return () => {
      disposed = true;
      macdChartRef.current?.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
    };
  }, [props.showMacd, props.dark]);

  useEffect(() => {
    if (!macdSeriesRef.current) return;
    const pts = (props.macd ?? [])
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    macdSeriesRef.current.setData(pts);
  }, [props.macd]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.classList.toggle('forex-drawings-hidden', Boolean(props.hideDrawings));
    Array.from(host.querySelectorAll('svg')).forEach((node) => {
      (node as SVGElement).style.visibility = props.hideDrawings ? 'hidden' : '';
    });
  }, [props.hideDrawings, props.tool]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Forex chart" />
        <div ref={overlayHostRef} className="pointer-events-none absolute inset-0 z-[1]" />
      </div>
      {props.showRsi ? (
        <div className="relative h-[88px] shrink-0 border-t border-border">
          <div className="absolute left-2 top-1 z-[2] text-[10px] text-muted-foreground">RSI 14</div>
          <div ref={rsiHostRef} className="absolute inset-0" />
        </div>
      ) : null}
      {props.showMacd ? (
        <div className="relative h-[88px] shrink-0 border-t border-border">
          <div className="absolute left-2 top-1 z-[2] text-[10px] text-muted-foreground">MACD 12/26/9</div>
          <div ref={macdHostRef} className="absolute inset-0" />
        </div>
      ) : null}
    </div>
  );
}

function applyToolMode(
  tool: ForexAnalysisTool,
  native: DrawingToolManager | null,
  extra: ForexDrawingEngine | null,
  toolRef: { current: ForexAnalysisTool }
): void {
  toolRef.current = tool;
  const nativeModes: DrawingToolMode[] = ['none', 'hline', 'vline', 'trend', 'fib'];
  const extraModes: ForexExtraTool[] = ['ray', 'extended', 'rect', 'arrow', 'fib2'];
  if (nativeModes.includes(tool as DrawingToolMode)) {
    native?.setMode(tool as DrawingToolMode);
    extra?.setMode('none');
  } else if (extraModes.includes(tool as ForexExtraTool)) {
    native?.setMode('none');
    extra?.setMode(tool as ForexExtraTool);
  } else {
    native?.setMode('none');
    extra?.setMode('none');
  }
}

function clearLines(ref: { current: IPriceLine[] }, series: { removePriceLine: (l: IPriceLine) => void } | null) {
  if (series) {
    for (const ln of ref.current) {
      try {
        series.removePriceLine(ln);
      } catch {
        /* ignore */
      }
    }
  }
  ref.current = [];
}

function applySeriesData(
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>,
  kind: ForexChartType,
  bars: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }>
) {
  if (kind === 'line' || kind === 'area') {
    (series as ISeriesApi<'Line'>).setData(bars.map((b) => ({ time: b.time, value: b.close })));
    return;
  }
  (series as ISeriesApi<'Candlestick'>).setData(bars);
}

function applySessionMarkers(
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>,
  bars: Array<{ time: UTCTimestamp }>,
  enabled: boolean,
  calendar: Array<{ time: number; text: string }> = []
) {
  if (!('setMarkers' in series)) return;
  const candle = series as ISeriesApi<'Candlestick'> & {
    setMarkers: (m: Array<{ time: UTCTimestamp; position: string; color: string; shape: string; text: string }>) => void;
  };
  const markers: Array<{ time: UTCTimestamp; position: 'belowBar' | 'aboveBar'; color: string; shape: 'circle' | 'square'; text: string }> = [];
  if (enabled && bars.length >= 2) {
    const from = Number(bars[0].time);
    const to = Number(bars[bars.length - 1].time);
    for (const b of buildSessionBoundaries(from, to).filter((x) => x.kind === 'open').slice(0, 40)) {
      markers.push({
        time: b.time as UTCTimestamp,
        position: 'belowBar',
        color: b.session === 'London' || b.session === 'NewYork' ? 'rgba(245,184,0,0.7)' : 'rgba(148,163,184,0.55)',
        shape: 'circle',
        text: b.session === 'NewYork' ? 'NY' : b.session.slice(0, 3),
      });
    }
  }
  const barTimes = new Set(bars.map((b) => Number(b.time)));
  const sortedBars = [...bars].sort((a, b) => Number(a.time) - Number(b.time));
  const snap = (t: number) => {
    if (barTimes.has(t)) return t;
    let best = sortedBars[0]?.time;
    let bestD = Infinity;
    for (const b of sortedBars) {
      const d = Math.abs(Number(b.time) - t);
      if (d < bestD) {
        bestD = d;
        best = b.time;
      }
    }
    return best;
  };
  for (const ev of calendar.slice(0, 24)) {
    if (!Number.isFinite(ev.time) || !sortedBars.length) continue;
    const t = snap(ev.time);
    if (t == null) continue;
    markers.push({
      time: t as UTCTimestamp,
      position: 'aboveBar',
      color: 'rgba(245,184,0,0.85)',
      shape: 'square',
      text: ev.text.slice(0, 12),
    });
  }
  markers.sort((a, b) => Number(a.time) - Number(b.time));
  const unique: typeof markers = [];
  const seenT = new Set<number>();
  for (const m of markers) {
    const t = Number(m.time);
    if (seenT.has(t)) continue;
    seenT.add(t);
    unique.push(m);
  }
  try {
    candle.setMarkers(unique);
  } catch {
    /* line/area may not support markers */
  }
}
