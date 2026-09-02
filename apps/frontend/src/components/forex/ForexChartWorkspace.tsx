'use client';

import { useMemo } from 'react';
import {
  chartsVisibleForLayout,
  type ForexChartLayout,
  useForexWorkspaceStore,
} from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexChartFoundation } from './ForexChartFoundation';

const LAYOUTS: Array<{ id: ForexChartLayout; label: string }> = [
  { id: '1', label: '1' },
  { id: '2h', label: '2H' },
  { id: '2v', label: '2V' },
  { id: '2x2', label: '2×2' },
];

export function ForexChartWorkspace() {
  const chartLayout = useForexWorkspaceStore((s) => s.chartLayout);
  const setChartLayout = useForexWorkspaceStore((s) => s.setChartLayout);
  const charts = useForexWorkspaceStore((s) => s.charts);
  const activeChartId = useForexWorkspaceStore((s) => s.activeChartId);
  const setActiveChartId = useForexWorkspaceStore((s) => s.setActiveChartId);
  const updateChartSlot = useForexWorkspaceStore((s) => s.updateChartSlot);
  const oneClickEnabled = useForexWorkspaceStore((s) => s.oneClickEnabled);
  const oneClickAcked = useForexWorkspaceStore((s) => s.oneClickAcked);
  const setOneClickEnabled = useForexWorkspaceStore((s) => s.setOneClickEnabled);
  const setOneClickAcked = useForexWorkspaceStore((s) => s.setOneClickAcked);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);

  const visible = useMemo(() => chartsVisibleForLayout(chartLayout, charts), [chartLayout, charts]);

  const gridClass =
    chartLayout === '1'
      ? 'grid-cols-1 grid-rows-1'
      : chartLayout === '2h'
        ? 'grid-cols-2 grid-rows-1'
        : chartLayout === '2v'
          ? 'grid-cols-1 grid-rows-2'
          : 'grid-cols-2 grid-rows-2';

  function toggleOneClick() {
    if (oneClickEnabled) {
      setOneClickEnabled(false);
      return;
    }
    if (!oneClickAcked) {
      const ok = window.confirm(
        'Enable One-Click Trading?\n\nMarket BUY/SELL will submit immediately through the simulated Forex API with the same risk/margin checks. No frontend bypass.\n\nDefault remains OFF after refresh.'
      );
      if (!ok) return;
      setOneClickAcked(true);
    }
    setOneClickEnabled(true);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-card/90 px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workspace</span>
        <div className="flex items-center gap-0.5" role="group" aria-label="Chart layout">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={chartLayout === l.id}
              onClick={() => setChartLayout(l.id)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                chartLayout === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <button
          type="button"
          aria-pressed={oneClickEnabled}
          onClick={toggleOneClick}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            oneClickEnabled ? 'bg-sell/20 text-sell' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          One-Click {oneClickEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setChartMode(chartMode === 'expand' ? 'normal' : 'expand')}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {chartMode === 'expand' ? 'Restore' : 'Expand'}
        </button>
        <button
          type="button"
          onClick={() => setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen')}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {chartMode === 'fullscreen' ? 'Exit FS' : 'Fullscreen'}
        </button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {visible.length} chart{visible.length === 1 ? '' : 's'} · link A keeps TF, syncs symbol
        </span>
      </div>

      <div className={cn('grid min-h-0 flex-1 gap-px bg-border', gridClass)}>
        {visible.map((slot) => (
          <div
            key={slot.id}
            className={cn(
              'relative min-h-0 min-w-0 bg-background',
              activeChartId === slot.id && 'ring-1 ring-inset ring-primary/50'
            )}
            onMouseDown={() => setActiveChartId(slot.id)}
          >
            <div className="absolute left-1 top-1 z-20 flex items-center gap-1">
              <span className="rounded bg-card/90 px-1 py-0.5 font-mono text-[9px] text-muted-foreground backdrop-blur">
                {slot.id.toUpperCase()}
              </span>
              <select
                aria-label={`Link group ${slot.id}`}
                value={slot.linkGroup}
                onChange={(e) =>
                  updateChartSlot(slot.id, { linkGroup: e.target.value as 'none' | 'A' | 'B' })
                }
                className="h-5 rounded border border-border bg-card/90 px-0.5 text-[9px] text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="none">Unlinked</option>
                <option value="A">Link A</option>
                <option value="B">Link B</option>
              </select>
            </div>
            <ForexChartFoundation
              instanceId={slot.id}
              symbol={slot.symbol}
              timeframe={slot.timeframe}
              active={activeChartId === slot.id}
              compactChrome={visible.length > 1}
              showOneClick={oneClickEnabled && activeChartId === slot.id}
              onActivate={() => setActiveChartId(slot.id)}
              onSymbolChange={(symbol) => {
                const group = slot.linkGroup;
                if (group === 'none') {
                  updateChartSlot(slot.id, { symbol });
                  return;
                }
                const all = useForexWorkspaceStore.getState().charts;
                for (const c of all) {
                  if (c.linkGroup === group) updateChartSlot(c.id, { symbol });
                }
              }}
              onTimeframeChange={(timeframe) => updateChartSlot(slot.id, { timeframe })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
