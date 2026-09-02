'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, IPriceLine, ISeriesApi, MouseEventParams, UTCTimestamp } from 'lightweight-charts';
import type { ForexCandle } from '@/lib/forex/models/candles';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { getDomChartThemeOptions, getTradingChartColors } from '@/components/trade/chart/cssTradingColors';

export type ForexChartType = 'candle' | 'line' | 'area' | 'ohlc';

type QuoteLevels = { bid: number; ask: number } | null;
type ProtectionLevels = { entry?: number; sl?: number; tp?: number };
type OverlayPoint = { time: number; value: number };

export type ForexChartCrosshair = {
  time: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  price: number | null;
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
  onCrosshair?: (state: ForexChartCrosshair) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'> | null>(
    null
  );
  const seriesKindRef = useRef<ForexChartType>('candle');
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
  const quoteRef = useRef<QuoteLevels>(props.quote);
  const candlesRef = useRef(props.candles);
  const digitsRef = useRef(props.digits ?? 5);
  const chartTypeRef = useRef<ForexChartType>(props.chartType ?? 'candle');
  const onCrosshairRef = useRef(props.onCrosshair);
  quoteRef.current = props.quote;
  candlesRef.current = props.candles;
  digitsRef.current = props.digits ?? 5;
  chartTypeRef.current = props.chartType ?? 'candle';
  onCrosshairRef.current = props.onCrosshair;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;
    const colors = getTradingChartColors();
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');
    const digits = digitsRef.current;
    const gridColor = props.dark ? 'rgba(245,184,0,0.06)' : 'rgba(15,23,42,0.06)';
    const gridVert = props.dark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.05)';

    void import('lightweight-charts').then((lwc) => {
      if (disposed || !hostRef.current) return;
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

      const q = quoteRef.current;
      if (q && 'createPriceLine' in series) {
        bidRef.current = series.createPriceLine(lineOpts(q.bid, colors.up, 'BID'));
        askRef.current = series.createPriceLine(lineOpts(q.ask, colors.down, 'ASK'));
      } else if (bars.length && 'createPriceLine' in series) {
        const last = bars[bars.length - 1].close;
        lastRef.current = series.createPriceLine(lineOpts(last, 'rgba(245,184,0,0.75)', 'LAST'));
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
        cb({
          time,
          open: row.open ?? null,
          high: row.high ?? null,
          low: row.low ?? null,
          close,
          price: close,
        });
      });
    });

    return () => {
      disposed = true;
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
    };
  }, [props.dark, props.digits, props.chartType]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const bars = toBars(props.candles);
    applySeriesData(series, seriesKindRef.current, bars);
    if (bars.length) chart.timeScale().fitContent();
  }, [props.candles]);

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
      apply(lastRef, last, 'rgba(245,184,0,0.75)', 'LAST');
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

  return <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Forex chart" />;
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
