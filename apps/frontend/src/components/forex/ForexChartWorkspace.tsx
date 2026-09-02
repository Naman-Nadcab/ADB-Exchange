'use client';

import { useMemo, useState } from 'react';
import {
  chartsVisibleForLayout,
  deleteWorkspaceProfile,
  gridClassForLayout,
  listWorkspaceProfiles,
  saveWorkspaceProfile,
  type ForexChartLayout,
  useForexWorkspaceStore,
} from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexChartFoundation } from './ForexChartFoundation';

const LAYOUTS: Array<{ id: ForexChartLayout; label: string; title: string }> = [
  { id: '1', label: '1', title: 'Single chart' },
  { id: '2h', label: '2H', title: 'Two horizontal' },
  { id: '2v', label: '2V', title: 'Two vertical' },
  { id: '2x2', label: '2×2', title: 'Four charts' },
  { id: '2x3', label: '2×3', title: 'Six charts' },
  { id: '3x3', label: '3×3', title: 'Nine charts' },
];

export function ForexChartWorkspace() {
  const chartLayout = useForexWorkspaceStore((s) => s.chartLayout);
  const setChartLayout = useForexWorkspaceStore((s) => s.setChartLayout);
  const charts = useForexWorkspaceStore((s) => s.charts);
  const activeChartId = useForexWorkspaceStore((s) => s.activeChartId);
  const setActiveChartId = useForexWorkspaceStore((s) => s.setActiveChartId);
  const updateChartSlot = useForexWorkspaceStore((s) => s.updateChartSlot);
  const maximizeChart = useForexWorkspaceStore((s) => s.maximizeChart);
  const restoreMaximizedChart = useForexWorkspaceStore((s) => s.restoreMaximizedChart);
  const maximizedChartId = useForexWorkspaceStore((s) => s.maximizedChartId);
  const oneClickEnabled = useForexWorkspaceStore((s) => s.oneClickEnabled);
  const oneClickAcked = useForexWorkspaceStore((s) => s.oneClickAcked);
  const setOneClickEnabled = useForexWorkspaceStore((s) => s.setOneClickEnabled);
  const setOneClickAcked = useForexWorkspaceStore((s) => s.setOneClickAcked);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);
  const panels = useForexWorkspaceStore((s) => s.panels);
  const captureSnapshot = useForexWorkspaceStore((s) => s.captureSnapshot);
  const applySnapshot = useForexWorkspaceStore((s) => s.applySnapshot);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profiles, setProfiles] = useState(() => (typeof window === 'undefined' ? [] : listWorkspaceProfiles()));

  const effectiveLayout: ForexChartLayout = maximizedChartId ? '1' : chartLayout;
  const visible = useMemo(() => {
    if (maximizedChartId) {
      const slot = charts.find((c) => c.id === maximizedChartId);
      return slot ? [slot] : chartsVisibleForLayout('1', charts);
    }
    return chartsVisibleForLayout(chartLayout, charts);
  }, [chartLayout, charts, maximizedChartId]);

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

  function refreshProfiles() {
    setProfiles(listWorkspaceProfiles());
  }

  function saveProfile() {
    const name = window.prompt('Workspace name', 'My Workspace');
    if (name == null || !name.trim()) return;
    saveWorkspaceProfile(name.trim(), captureSnapshot());
    refreshProfiles();
    setProfilesOpen(true);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border bg-card px-1.5">
        <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Charts</span>
        <div className="flex items-center gap-px" role="group" aria-label="Chart layout">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              title={l.title}
              aria-pressed={effectiveLayout === l.id && !maximizedChartId}
              onClick={() => {
                if (maximizedChartId) restoreMaximizedChart();
                setChartLayout(l.id);
              }}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                !maximizedChartId && chartLayout === l.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-3.5 w-px bg-border" aria-hidden />
        <button
          type="button"
          aria-pressed={oneClickEnabled}
          onClick={toggleOneClick}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            oneClickEnabled ? 'bg-sell/20 text-sell' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          1-Click {oneClickEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setPanel('watchlist', !panels.watchlist)}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          aria-pressed={panels.watchlist}
          title="Toggle Market Watch"
        >
          MW
        </button>
        <button
          type="button"
          onClick={() => setPanel('ticket', !panels.ticket)}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          aria-pressed={panels.ticket}
          title="Toggle Order Ticket"
        >
          Ticket
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
          {chartMode === 'fullscreen' ? 'Exit FS' : 'FS'}
        </button>
        {maximizedChartId ? (
          <button
            type="button"
            onClick={() => restoreMaximizedChart()}
            className="rounded px-1.5 py-0.5 text-[10px] text-primary"
          >
            Unmax
          </button>
        ) : null}
        <div className="relative ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={saveProfile}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Save WS
          </button>
          <button
            type="button"
            onClick={() => {
              refreshProfiles();
              setProfilesOpen((v) => !v);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            aria-expanded={profilesOpen}
          >
            Load WS
          </button>
          <span className="hidden font-mono text-[9px] text-muted-foreground xl:inline">
            {visible.length} chart{visible.length === 1 ? '' : 's'} · SIMULATED
          </span>
          {profilesOpen ? (
            <div className="absolute right-0 top-full z-40 mt-0.5 min-w-[200px] rounded border border-border bg-card py-1 shadow-lg">
              {profiles.length === 0 ? (
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No saved workspaces.</p>
              ) : (
                profiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 px-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate px-1.5 py-1 text-left text-[11px] hover:bg-accent"
                      onClick={() => {
                        applySnapshot(p.snapshot);
                        setProfilesOpen(false);
                      }}
                    >
                      {p.name}
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        {new Date(p.savedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="px-1 text-[10px] text-muted-foreground hover:text-sell"
                      onClick={() => {
                        deleteWorkspaceProfile(p.id);
                        refreshProfiles();
                      }}
                      aria-label={`Delete ${p.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn('grid min-h-0 flex-1 gap-px bg-border', gridClassForLayout(effectiveLayout))}>
        {visible.map((slot) => (
          <div
            key={slot.id}
            className={cn(
              'relative min-h-0 min-w-0 bg-background',
              activeChartId === slot.id && 'ring-1 ring-inset ring-primary/45'
            )}
            onMouseDown={() => setActiveChartId(slot.id)}
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
                title="Chart link group — symbol sync, timeframe stays per chart"
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
