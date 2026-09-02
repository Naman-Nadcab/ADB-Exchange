'use client';

import { useState } from 'react';
import {
  deleteChartTemplate,
  listChartTemplates,
  listWorkspaceProfiles,
  saveChartTemplate,
  saveWorkspaceProfile,
  type ForexChartLayout,
  useForexWorkspaceStore,
} from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

const LAYOUTS: Array<{ id: ForexChartLayout; label: string }> = [
  { id: '1', label: '1' },
  { id: '2h', label: '2H' },
  { id: '2v', label: '2V' },
  { id: '2x2', label: '2×2' },
  { id: '2x3', label: '2×3' },
  { id: '3x3', label: '3×3' },
];

/**
 * Compact MT5-style application toolbar — only working controls, no dead menus.
 */
export function ForexAppToolbar() {
  const panels = useForexWorkspaceStore((s) => s.panels);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);
  const chartLayout = useForexWorkspaceStore((s) => s.chartLayout);
  const setChartLayout = useForexWorkspaceStore((s) => s.setChartLayout);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const bottomCollapsed = useForexWorkspaceStore((s) => s.bottomCollapsed);
  const setBottomCollapsed = useForexWorkspaceStore((s) => s.setBottomCollapsed);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const selectedSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const activeChartId = useForexWorkspaceStore((s) => s.activeChartId);
  const addChart = useForexWorkspaceStore((s) => s.addChart);
  const removeChart = useForexWorkspaceStore((s) => s.removeChart);
  const duplicateChart = useForexWorkspaceStore((s) => s.duplicateChart);
  const linkTimeframe = useForexWorkspaceStore((s) => s.linkTimeframe);
  const setLinkTimeframe = useForexWorkspaceStore((s) => s.setLinkTimeframe);
  const oneClickEnabled = useForexWorkspaceStore((s) => s.oneClickEnabled);
  const oneClickAcked = useForexWorkspaceStore((s) => s.oneClickAcked);
  const setOneClickEnabled = useForexWorkspaceStore((s) => s.setOneClickEnabled);
  const setOneClickAcked = useForexWorkspaceStore((s) => s.setOneClickAcked);
  const captureSnapshot = useForexWorkspaceStore((s) => s.captureSnapshot);
  const applySnapshot = useForexWorkspaceStore((s) => s.applySnapshot);
  const restoreMaximizedChart = useForexWorkspaceStore((s) => s.restoreMaximizedChart);
  const maximizedChartId = useForexWorkspaceStore((s) => s.maximizedChartId);

  const [menu, setMenu] = useState<string | null>(null);

  function toggleOneClick() {
    if (oneClickEnabled) {
      setOneClickEnabled(false);
      return;
    }
    if (!oneClickAcked) {
      const ok = window.confirm(
        'Enable One-Click Trading?\n\nMarket BUY/SELL submits immediately through the simulated Forex API with the same risk checks. Remains OFF after refresh.'
      );
      if (!ok) return;
      setOneClickAcked(true);
    }
    setOneClickEnabled(true);
  }

  return (
    <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border bg-[#15181d] px-1.5 text-[11px]">
      <Menu
        id="file"
        label="File"
        open={menu}
        setOpen={setMenu}
        items={[
          {
            label: 'New Order',
            onClick: () => {
              setPanel('ticket', true);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
            },
          },
          {
            label: 'Save Workspace',
            onClick: () => {
              const name = window.prompt('Workspace name', 'My Workspace');
              if (!name?.trim()) return;
              saveWorkspaceProfile(name.trim(), captureSnapshot());
            },
          },
          {
            label: 'Load Workspace…',
            onClick: () => {
              const profiles = listWorkspaceProfiles();
              if (!profiles.length) {
                window.alert('No saved workspaces.');
                return;
              }
              const names = profiles.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
              const pick = window.prompt(`Load workspace:\n${names}\n\nEnter number`, '1');
              const idx = Number(pick) - 1;
              if (!profiles[idx]) return;
              applySnapshot(profiles[idx].snapshot);
            },
          },
          {
            label: 'Save Chart Template',
            onClick: () => {
              const name = window.prompt('Template name', 'Scalping');
              if (!name?.trim()) return;
              saveChartTemplate({
                name: name.trim(),
                study: 'ema20_50',
                showRsi: false,
                showMacd: false,
                showSessions: false,
                showLevels: false,
                chartType: 'candles',
              });
            },
          },
          {
            label: 'Manage Templates…',
            onClick: () => {
              const t = listChartTemplates();
              if (!t.length) {
                window.alert('No chart templates saved.');
                return;
              }
              window.alert(t.map((x) => `• ${x.name} (${x.study})`).join('\n'));
            },
          },
        ]}
      />
      <Menu
        id="view"
        label="View"
        open={menu}
        setOpen={setMenu}
        items={[
          {
            label: panels.watchlist ? 'Hide Market Watch' : 'Show Market Watch',
            onClick: () => setPanel('watchlist', !panels.watchlist),
          },
          {
            label: panels.ticket ? 'Hide Order Ticket' : 'Show Order Ticket',
            onClick: () => setPanel('ticket', !panels.ticket),
          },
          {
            label: bottomCollapsed ? 'Expand Toolbox' : 'Collapse Toolbox',
            onClick: () => setBottomCollapsed(!bottomCollapsed),
          },
          {
            label: chartMode === 'expand' ? 'Restore Panels' : 'Chart Expand',
            onClick: () => setChartMode(chartMode === 'expand' ? 'normal' : 'expand'),
          },
          {
            label: chartMode === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen Chart',
            onClick: () => setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen'),
          },
          {
            label: maximizedChartId ? 'Unmaximize Chart' : '—',
            onClick: () => {
              if (maximizedChartId) restoreMaximizedChart();
            },
            disabled: !maximizedChartId,
          },
        ]}
      />
      <Menu
        id="charts"
        label="Charts"
        open={menu}
        setOpen={setMenu}
        items={[
          { label: 'Add Chart', onClick: () => addChart(selectedSymbol) },
          { label: 'Duplicate Active', onClick: () => duplicateChart(activeChartId) },
          { label: 'Remove Active', onClick: () => removeChart(activeChartId) },
          {
            label: linkTimeframe ? 'Unlink Timeframes' : 'Link Timeframes (group)',
            onClick: () => setLinkTimeframe(!linkTimeframe),
          },
        ]}
      />
      <Menu
        id="trading"
        label="Trading"
        open={menu}
        setOpen={setMenu}
        items={[
          {
            label: 'New Order',
            onClick: () => {
              setPanel('ticket', true);
              setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
            },
          },
          { label: oneClickEnabled ? 'Disable One-Click' : 'Enable One-Click…', onClick: toggleOneClick },
          {
            label: 'Open Positions',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('positions');
            },
          },
          {
            label: 'Working Orders',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('orders');
            },
          },
        ]}
      />
      <Menu
        id="tools"
        label="Tools"
        open={menu}
        setOpen={setMenu}
        items={[
          {
            label: 'DOM (Depth)',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('dom');
            },
          },
          {
            label: 'News',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('news');
            },
          },
          {
            label: 'Calendar',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('calendar');
            },
          },
          {
            label: 'Journal',
            onClick: () => {
              setBottomCollapsed(false);
              setBottomTab('journal');
            },
          },
          {
            label: 'Delete Last Template',
            onClick: () => {
              const t = listChartTemplates()[0];
              if (t) deleteChartTemplate(t.id);
            },
          },
        ]}
      />

      <span className="mx-1 h-3.5 w-px bg-border" aria-hidden />
      <div className="flex items-center gap-px" role="group" aria-label="Chart layout">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={chartLayout === l.id && !maximizedChartId}
            onClick={() => {
              if (maximizedChartId) restoreMaximizedChart();
              setChartLayout(l.id);
            }}
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
              !maximizedChartId && chartLayout === l.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={oneClickEnabled}
        onClick={toggleOneClick}
        className={cn(
          'ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
          oneClickEnabled ? 'bg-sell/25 text-sell' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        1-Click {oneClickEnabled ? 'ON' : 'OFF'}
      </button>
      <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-amber-200/80">
        {selectedSymbol} · SIMULATED
      </span>
    </div>
  );
}

function Menu(props: {
  id: string;
  label: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  items: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
}) {
  const open = props.open === props.id;
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'rounded px-1.5 py-0.5 font-medium',
          open ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
        aria-expanded={open}
        onClick={() => props.setOpen(open ? null : props.id)}
        onBlur={() => {
          /* keep open for click */
        }}
      >
        {props.label}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-0.5 min-w-[180px] border border-border bg-[#1a1f26] py-1 shadow-lg"
          onMouseLeave={() => props.setOpen(null)}
        >
          {props.items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              className="block w-full px-2.5 py-1 text-left text-[11px] text-foreground hover:bg-accent disabled:opacity-40"
              onClick={() => {
                item.onClick();
                props.setOpen(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
