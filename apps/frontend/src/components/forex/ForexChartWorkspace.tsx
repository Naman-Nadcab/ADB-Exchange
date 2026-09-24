'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  chartsVisibleForLayout,
  gridClassForLayout,
  type ForexChartLayout,
  useForexWorkspaceStore,
} from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexChartFoundation } from './ForexChartFoundation';

export function ForexChartWorkspace() {
  const tw = useTranslations('forex.chartWorkspace');
  const chartLayout = useForexWorkspaceStore((s) => s.chartLayout);
  const charts = useForexWorkspaceStore((s) => s.charts);
  const activeChartId = useForexWorkspaceStore((s) => s.activeChartId);
  const setActiveChartId = useForexWorkspaceStore((s) => s.setActiveChartId);
  const updateChartSlot = useForexWorkspaceStore((s) => s.updateChartSlot);
  const maximizeChart = useForexWorkspaceStore((s) => s.maximizeChart);
  const maximizedChartId = useForexWorkspaceStore((s) => s.maximizedChartId);
  const oneClickEnabled = useForexWorkspaceStore((s) => s.oneClickEnabled);
  const addChart = useForexWorkspaceStore((s) => s.addChart);
  const removeChart = useForexWorkspaceStore((s) => s.removeChart);
  const duplicateChart = useForexWorkspaceStore((s) => s.duplicateChart);
  const selectedSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const linkTimeframe = useForexWorkspaceStore((s) => s.linkTimeframe);

  const effectiveLayout: ForexChartLayout = maximizedChartId ? '1' : chartLayout;
  const visible = useMemo(() => {
    if (maximizedChartId) {
      const slot = charts.find((c) => c.id === maximizedChartId);
      return slot ? [slot] : chartsVisibleForLayout('1', charts);
    }
    return chartsVisibleForLayout(chartLayout, charts);
  }, [chartLayout, charts, maximizedChartId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {visible.length > 1 || chartLayout !== '1' ? (
        <div className="flex h-5 shrink-0 items-center gap-1 border-b border-border/60 bg-card/60 px-1.5">
          <button type="button" className="text-[9px] text-muted-foreground hover:text-foreground" onClick={() => addChart(selectedSymbol)} title={tw('workspaceLabel')}>
            +
          </button>
          <button type="button" className="text-[9px] text-muted-foreground hover:text-foreground" onClick={() => duplicateChart(activeChartId)}>
            {tw('dupShort')}
          </button>
          <button
            type="button"
            className="text-[9px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            onClick={() => removeChart(activeChartId)}
            disabled={charts.length <= 1}
          >
            {tw('removeShort')}
          </button>
          <span className="ml-auto font-mono text-[8px] text-muted-foreground">
            {visible.length}×{linkTimeframe ? ' · TF' : ''}
          </span>
        </div>
      ) : null}

      <div className={cn('grid min-h-0 flex-1 gap-px bg-border', gridClassForLayout(effectiveLayout))}>
        {visible.map((slot) => (
          <div
            key={slot.id}
            className={cn(
              'relative min-h-0 min-w-0 bg-background',
              activeChartId === slot.id && 'ring-1 ring-inset ring-primary/45'
            )}
            onMouseDown={() => setActiveChartId(slot.id)}
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes('text/forex-symbol')) e.preventDefault();
            }}
            onDrop={(e) => {
              const symbol = e.dataTransfer.getData('text/forex-symbol').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (!symbol) return;
              e.preventDefault();
              setActiveChartId(slot.id);
              updateChartSlot(slot.id, { symbol });
            }}
          >
            <div className="absolute right-1 top-1 z-20 flex items-center gap-0.5">
              <select
                aria-label={`Link group ${slot.id}`}
                value={slot.linkGroup}
                onChange={(e) =>
                  updateChartSlot(slot.id, { linkGroup: e.target.value as 'none' | 'A' | 'B' })
                }
                className="h-5 rounded border border-border bg-card/95 px-0.5 text-[9px] text-foreground"
                onClick={(e) => e.stopPropagation()}
                title={tw('linkGroupTitle')}
              >
                <option value="none">○</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
              <button
                type="button"
                className="h-5 rounded border border-border bg-card/95 px-1 text-[9px] text-muted-foreground hover:text-foreground"
                title={maximizedChartId === slot.id ? 'Restore layout' : 'Maximize chart'}
                onClick={(e) => {
                  e.stopPropagation();
                  maximizeChart(slot.id);
                }}
              >
                {maximizedChartId === slot.id ? '⧉' : '▣'}
              </button>
            </div>
            <ForexChartFoundation
              instanceId={slot.id}
              symbol={slot.symbol}
              timeframe={slot.timeframe}
              active={activeChartId === slot.id}
              compactChrome={visible.length > 1}
              showOneClick={oneClickEnabled && activeChartId === slot.id}
              onActivate={() => setActiveChartId(slot.id)}
              onSymbolChange={(symbol) => updateChartSlot(slot.id, { symbol })}
              onTimeframeChange={(timeframe) => updateChartSlot(slot.id, { timeframe })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
