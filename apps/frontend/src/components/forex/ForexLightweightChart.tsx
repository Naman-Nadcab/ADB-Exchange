'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { ForexCandle } from '@/lib/forex/models/candles';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { getDomChartThemeOptions, getTradingChartColors } from '@/components/trade/chart/cssTradingColors';

type QuoteLevels = { bid: number; ask: number } | null;
type ProtectionLevels = { entry?: number; sl?: number; tp?: number };
type OverlayPoint = { time: number; value: number };

function toBars(candles: ForexCandle[]) {
  const out: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
  for (const c of candles) {
    const ms = candleTimeMs(c.timestamp);
    if (ms == null) continue;
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
    out.push({ time: Math.floor(ms / 1000) as UTCTimestamp, open, high, low, close });
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
  overlay?: OverlayPoint[];
  bands?: { upper: OverlayPoint[]; lower: OverlayPoint[] };
  levels?: ProtectionLevels;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlayRef = useRef<ISeriesApi<'Line'> | null>(null);
  const upperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bidRef = useRef<IPriceLine | null>(null);
  const askRef = useRef<IPriceLine | null>(null);
  const entryRef = useRef<IPriceLine | null>(null);
  const slRef = useRef<IPriceLine | null>(null);
  const tpRef = useRef<IPriceLine | null>(null);
  const quoteRef = useRef<QuoteLevels>(props.quote);
  const candlesRef = useRef(props.candles);
  const digitsRef = useRef(props.digits ?? 5);
  quoteRef.current = props.quote;
  candlesRef.current = props.candles;
  digitsRef.current = props.digits ?? 5;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;
    const colors = getTradingChartColors();
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');
    const digits = digitsRef.current;

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
          vertLines: { color: theme.grid.vertLines.color },
          horzLines: { color: theme.grid.horzLines.color },
        },
        crosshair: { mode: lwc.CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: theme.rightPriceScale.borderColor,
          entireTextOnly: true,
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: { borderColor: theme.timeScale.borderColor, timeVisible: true, secondsVisible: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      });
      const series = chart.addCandlestickSeries({
        upColor: colors.up,
        downColor: colors.down,
        borderVisible: false,
        wickUpColor: colors.up,
        wickDownColor: colors.down,
        priceFormat: { type: 'price', precision: digits, minMove: minMove(digits) },
        autoscaleInfoProvider: (original: () => unknown) => {
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
            const pad = span * 0.12;
            return { priceRange: { minValue: lo - pad, maxValue: hi + pad } };
          }
          if (!q) return base;
          const mid = (q.bid + q.ask) / 2;
          const pad = Math.max(Math.abs(mid) * 0.0008, (q.ask - q.bid) * 20, minMove(digitsRef.current) * 50);
          return { priceRange: { minValue: mid - pad, maxValue: mid + pad } };
        },
      });
      chartRef.current = chart;
      seriesRef.current = series;
      overlayRef.current = chart.addLineSeries({
        color: 'rgba(245,184,0,0.85)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'price', precision: digits, minMove: minMove(digits) },
      });
      upperRef.current = chart.addLineSeries({
        color: 'rgba(156,163,175,0.55)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'price', precision: digits, minMove: minMove(digits) },
      });
      lowerRef.current = chart.addLineSeries({
        color: 'rgba(156,163,175,0.55)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'price', precision: digits, minMove: minMove(digits) },
      });
      const bars = toBars(candlesRef.current);
      series.setData(bars);
      if (bars.length) chart.timeScale().fitContent();
      const q = quoteRef.current;
      if (q) {
        bidRef.current = series.createPriceLine(lineOpts(q.bid, colors.up, 'BID'));
        askRef.current = series.createPriceLine(lineOpts(q.ask, colors.down, 'ASK'));
      }
    });

    return () => {
      disposed = true;
      bidRef.current = null;
      askRef.current = null;
      entryRef.current = null;
      slRef.current = null;
      tpRef.current = null;
      overlayRef.current = null;
      upperRef.current = null;
      lowerRef.current = null;
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [props.dark, props.digits]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const bars = toBars(props.candles);
    series.setData(bars);
    if (bars.length) chart.timeScale().fitContent();
  }, [props.candles]);

  useEffect(() => {
    const map = (pts: OverlayPoint[]) =>
      pts
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    overlayRef.current?.setData(map(props.overlay ?? []));
    upperRef.current?.setData(map(props.bands?.upper ?? []));
    lowerRef.current?.setData(map(props.bands?.lower ?? []));
  }, [props.overlay, props.bands]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
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
    } else {
      apply(bidRef, props.quote.bid, colors.up, 'BID');
      apply(askRef, props.quote.ask, colors.down, 'ASK');
    }
    apply(entryRef, props.levels?.entry, 'rgba(245,184,0,0.85)', 'Entry');
    apply(slRef, props.levels?.sl, colors.down, 'SL');
    apply(tpRef, props.levels?.tp, colors.up, 'TP');
  }, [props.quote, props.levels]);

  return <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Forex chart" />;
}
