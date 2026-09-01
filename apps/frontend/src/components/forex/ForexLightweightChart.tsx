'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { ForexCandle } from '@/lib/forex/models/candles';
import { candleTimeMs } from '@/lib/forex/models/candles';

type QuoteLevels = { bid: number; ask: number } | null;

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
    out.push({ time: Math.floor(ms / 1000) as UTCTimestamp, open, high, low, close });
  }
  return out;
}

export function ForexLightweightChart(props: {
  candles: ForexCandle[];
  quote: QuoteLevels;
  dark: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const bidRef = useRef<IPriceLine | null>(null);
  const askRef = useRef<IPriceLine | null>(null);
  const quoteRef = useRef<QuoteLevels>(props.quote);
  const candlesRef = useRef(props.candles);
  quoteRef.current = props.quote;
  candlesRef.current = props.candles;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;

    void import('lightweight-charts').then((lwc) => {
      if (disposed || !hostRef.current) return;
      const chart = lwc.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: props.dark ? '#0c0d0f' : '#f7f6f3' },
          textColor: props.dark ? '#a8a29e' : '#57534e',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: props.dark ? '#1c1917' : '#e7e5e4' },
          horzLines: { color: props.dark ? '#1c1917' : '#e7e5e4' },
        },
        crosshair: { mode: lwc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: props.dark ? '#292524' : '#d6d3d1', entireTextOnly: true },
        timeScale: { borderColor: props.dark ? '#292524' : '#d6d3d1', timeVisible: true, secondsVisible: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      });
      const series = chart.addCandlestickSeries({
        upColor: '#0f766e',
        downColor: '#be123c',
        borderVisible: false,
        wickUpColor: '#0f766e',
        wickDownColor: '#be123c',
        autoscaleInfoProvider: (original: () => unknown) => {
          const base = original() as { priceRange?: { minValue: number; maxValue: number } } | null;
          const q = quoteRef.current;
          if (!q) return base;
          const pad = Math.max((q.ask - q.bid) * 4, 1e-6);
          const minValue = q.bid - pad;
          const maxValue = q.ask + pad;
          if (!base?.priceRange) return { priceRange: { minValue, maxValue } };
          return {
            ...base,
            priceRange: {
              minValue: Math.min(base.priceRange.minValue, minValue),
              maxValue: Math.max(base.priceRange.maxValue, maxValue),
            },
          };
        },
      });
      chartRef.current = chart;
      seriesRef.current = series;
      series.setData(toBars(candlesRef.current));
      const q = quoteRef.current;
      if (q) {
        bidRef.current = series.createPriceLine({
          price: q.bid,
          color: '#0f766e',
          lineWidth: 1,
          axisLabelVisible: true,
          title: 'BID',
        });
        askRef.current = series.createPriceLine({
          price: q.ask,
          color: '#be123c',
          lineWidth: 1,
          axisLabelVisible: true,
          title: 'ASK',
        });
      }
    });

    return () => {
      disposed = true;
      bidRef.current = null;
      askRef.current = null;
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [props.dark]);

  useEffect(() => {
    seriesRef.current?.setData(toBars(props.candles));
  }, [props.candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (!props.quote) {
      if (bidRef.current) series.removePriceLine(bidRef.current);
      if (askRef.current) series.removePriceLine(askRef.current);
      bidRef.current = null;
      askRef.current = null;
      return;
    }
    if (!bidRef.current) {
      bidRef.current = series.createPriceLine({
        price: props.quote.bid,
        color: '#0f766e',
        lineWidth: 1,
        axisLabelVisible: true,
        title: 'BID',
      });
    } else {
      bidRef.current.applyOptions({ price: props.quote.bid });
    }
    if (!askRef.current) {
      askRef.current = series.createPriceLine({
        price: props.quote.ask,
        color: '#be123c',
        lineWidth: 1,
        axisLabelVisible: true,
        title: 'ASK',
      });
    } else {
      askRef.current.applyOptions({ price: props.quote.ask });
    }
  }, [props.quote]);

  return <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Forex chart" />;
}
