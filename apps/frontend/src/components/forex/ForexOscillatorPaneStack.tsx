'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { getDomChartThemeOptions } from '@/components/trade/chart/cssTradingColors';

export type OscillatorPaneSpec = {
  key: string;
  label: string;
  series: Array<{ id: string; color: string; points: Array<{ time: number; value: number }> }>;
  referenceLines?: Array<{ value: number; color: string }>;
};

export function ForexOscillatorPaneStack(props: {
  panes: OscillatorPaneSpec[];
  dark: boolean;
  mainChart: IChartApi | null;
}) {
  const hostsRef = useRef<(HTMLDivElement | null)[]>([]);
  const chartsRef = useRef<(IChartApi | null)[]>([]);
  const seriesRef = useRef<ISeriesApi<'Line'>[][]>([]);

  useEffect(() => {
    const panes = props.panes;
    let disposed = false;
    const theme = getDomChartThemeOptions(props.dark ? 'dark' : 'light');

    void import('lightweight-charts').then((lwc) => {
      if (disposed) return;
      chartsRef.current.forEach((c) => c?.remove());
      chartsRef.current = [];
      seriesRef.current = [];

      panes.forEach((pane, idx) => {
        const host = hostsRef.current[idx];
        if (!host) return;
        host.replaceChildren();
        const paneSeries: ISeriesApi<'Line'>[] = [];
        const chart = lwc.createChart(host, {
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
          timeScale: { visible: idx === panes.length - 1, borderVisible: false },
          crosshair: { mode: lwc.CrosshairMode.Normal },
        });
        for (const s of pane.series) {
          const line = chart.addLineSeries({
            color: s.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          const pts = s.points
            .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
            .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
          line.setData(pts);
          paneSeries.push(line);
          if (pane.series[0] === s) {
            for (const h of pane.referenceLines ?? []) {
              line.createPriceLine({
                price: h.value,
                color: h.color,
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: false,
              });
            }
          }
        }
        seriesRef.current[idx] = paneSeries;
        chartsRef.current[idx] = chart;
        if (props.mainChart) {
          const sync = () => {
            const range = props.mainChart?.timeScale().getVisibleLogicalRange();
            if (range) chart.timeScale().setVisibleLogicalRange(range);
          };
          props.mainChart.timeScale().subscribeVisibleLogicalRangeChange(sync);
          sync();
        }
      });
    });

    return () => {
      disposed = true;
      chartsRef.current.forEach((c) => c?.remove());
      chartsRef.current = [];
    };
  }, [props.panes, props.dark, props.mainChart]);

  if (props.panes.length === 0) return null;

  return (
    <>
      {props.panes.map((pane, idx) => (
        <div key={pane.key} className="relative h-[92px] shrink-0 border-t border-border">
          <div className="absolute left-2 top-1 z-[2] text-[10px] text-muted-foreground">{pane.label}</div>
          <div
            ref={(el) => {
              hostsRef.current[idx] = el;
            }}
            className="absolute inset-0"
          />
        </div>
      ))}
    </>
  );
}
