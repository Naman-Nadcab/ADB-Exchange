'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const tf = useTranslations('forex.appToolbar');
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
      const ok = window.confirm(tf('oneClickConfirm'));
      if (!ok) return;
      setOneClickAcked(true);
    }
    setOneClickEnabled(true);
  }

  const fileItems = useMemo(
    () => [
      {
        label: tf('newOrder'),
        onClick: () => {
          setPanel('ticket', true);
          setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
        },
      },
      {
        label: tf('saveWorkspace'),
        onClick: () => {
          const name = window.prompt(tf('workspaceNamePrompt'), tf('workspaceDefaultName'));
          if (!name?.trim()) return;
          saveWorkspaceProfile(name.trim(), captureSnapshot());
        },
      },
      {
        label: tf('loadWorkspace'),
        onClick: () => {
          const profiles = listWorkspaceProfiles();
          if (!profiles.length) {
            window.alert(tf('noSavedWorkspaces'));
            return;
          }
          const names = profiles.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
          const pick = window.prompt(tf('loadWorkspacePrompt', { names }), '1');
          const idx = Number(pick) - 1;
          if (!profiles[idx]) return;
          applySnapshot(profiles[idx].snapshot);
        },
      },
      {
        label: tf('saveStudyPreset'),
        onClick: () => {
          const name = window.prompt(tf('studyPresetPrompt'), tf('studyPresetDefault'));
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
        label: tf('listStudyPresets'),
        onClick: () => {
          const t = listChartTemplates();
          if (!t.length) {
            window.alert(tf('noStudyPresets'));
            return;
          }
          window.alert(
            tf('studyPresetsList', { list: t.map((x) => `• ${x.name} (${x.study})`).join('\n') })
          );
        },
      },
    ],
    [applySnapshot, captureSnapshot, setPanel, setTicketDraft, tf]
  );

  const viewItems = useMemo(
    () => [
      {
        label: panels.watchlist ? tf('hideMarketWatch') : tf('showMarketWatch'),
        onClick: () => setPanel('watchlist', !panels.watchlist),
      },
      {
        label: panels.ticket ? tf('hideOrderTicket') : tf('showOrderTicket'),
        onClick: () => setPanel('ticket', !panels.ticket),
      },
      {
        label: bottomCollapsed ? tf('expandToolbox') : tf('collapseToolbox'),
        onClick: () => setBottomCollapsed(!bottomCollapsed),
      },
      {
        label: chartMode === 'expand' ? tf('restorePanels') : tf('chartExpand'),
        onClick: () => setChartMode(chartMode === 'expand' ? 'normal' : 'expand'),
      },
      {
        label: chartMode === 'fullscreen' ? tf('exitFullscreen') : tf('fullscreenChart'),
        onClick: () => setChartMode(chartMode === 'fullscreen' ? 'normal' : 'fullscreen'),
      },
      {
        label: maximizedChartId ? tf('unmaximizeChart') : tf('unmaximizePlaceholder'),
        onClick: () => {
          if (maximizedChartId) restoreMaximizedChart();
        },
        disabled: !maximizedChartId,
      },
    ],
    [
      bottomCollapsed,
      chartMode,
      maximizedChartId,
      panels.ticket,
      panels.watchlist,
      restoreMaximizedChart,
      setBottomCollapsed,
      setChartMode,
      setPanel,
      tf,
    ]
  );

  const chartsItems = useMemo(
    () => [
      { label: tf('addChart'), onClick: () => addChart(selectedSymbol) },
      { label: tf('duplicateActive'), onClick: () => duplicateChart(activeChartId) },
      { label: tf('removeActive'), onClick: () => removeChart(activeChartId) },
      {
        label: linkTimeframe ? tf('unlinkTimeframes') : tf('linkTimeframes'),
        onClick: () => setLinkTimeframe(!linkTimeframe),
      },
    ],
    [activeChartId, addChart, duplicateChart, linkTimeframe, removeChart, selectedSymbol, setLinkTimeframe, tf]
  );

  const tradingItems = useMemo(
    () => [
      {
        label: tf('newOrder'),
        onClick: () => {
          setPanel('ticket', true);
          setTicketDraft({ nonce: Date.now(), orderType: 'market', side: 'buy' });
        },
      },
      { label: oneClickEnabled ? tf('disableOneClick') : tf('enableOneClick'), onClick: toggleOneClick },
      {
        label: tf('openPositions'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('positions');
        },
      },
      {
        label: tf('workingOrders'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('orders');
        },
      },
    ],
    [oneClickEnabled, setBottomCollapsed, setBottomTab, setPanel, setTicketDraft, tf]
  );

  const toolsItems = useMemo(
    () => [
      {
        label: tf('domDepth'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('dom');
        },
      },
      {
        label: tf('news'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('news');
        },
      },
      {
        label: tf('calendar'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('calendar');
        },
      },
      {
        label: tf('journal'),
        onClick: () => {
          setBottomCollapsed(false);
          setBottomTab('journal');
        },
      },
      {
        label: tf('deleteLastTemplate'),
        onClick: () => {
          const t = listChartTemplates()[0];
          if (t) deleteChartTemplate(t.id);
        },
      },
    ],
    [setBottomCollapsed, setBottomTab, tf]
  );

  type ToolbarItem = { label: string; onClick: () => void; disabled?: boolean };
  const withGroup = (group: string, items: ToolbarItem[]) => items.map((i) => ({ ...i, group }));

  const mobileOverflowItems = useMemo(
    () => [
      ...withGroup(tf('file'), fileItems),
      ...withGroup(tf('view'), viewItems),
      ...withGroup(tf('charts'), chartsItems),
      ...withGroup(tf('trading'), tradingItems),
      ...withGroup(tf('tools'), toolsItems),
    ],
    [chartsItems, fileItems, tf, toolsItems, tradingItems, viewItems]
  );

  return (
    <div className="relative flex h-7 shrink-0 items-center gap-1 border-b border-border bg-[#15181d] px-1.5 text-[11px]">
      <Menu
        id="mobile"
        label={tf('menu')}
        open={menu}
        setOpen={setMenu}
        className="md:hidden"
        items={mobileOverflowItems.map((item) => ({
          label: tf('mobileMenuItem', { group: item.group, label: item.label }),
          onClick: item.onClick,
          disabled: item.disabled,
        }))}
      />
      <Menu id="file" label={tf('file')} className="hidden md:block" open={menu} setOpen={setMenu} items={fileItems} />
      <Menu id="view" label={tf('view')} className="hidden md:block" open={menu} setOpen={setMenu} items={viewItems} />
      <Menu id="charts" label={tf('charts')} className="hidden md:block" open={menu} setOpen={setMenu} items={chartsItems} />
      <Menu id="trading" label={tf('trading')} className="hidden md:block" open={menu} setOpen={setMenu} items={tradingItems} />
      <Menu id="tools" label={tf('tools')} className="hidden md:block" open={menu} setOpen={setMenu} items={toolsItems} />

      <span className="mx-1 hidden h-3.5 w-px bg-border md:inline" aria-hidden />
      <div className="hidden items-center gap-px sm:flex" role="group" aria-label={tf('chartLayoutAria')}>
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
          'ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
          oneClickEnabled
            ? 'bg-sell/25 text-sell ring-1 ring-sell/40'
            : 'border border-border/80 bg-[#1a1f26] text-foreground'
        )}
        title={oneClickEnabled ? tf('oneClickOnTitle') : tf('oneClickOffTitle')}
      >
        {tf('oneClickLabel', { state: oneClickEnabled ? tf('oneClickOn') : tf('oneClickOff') })}
      </button>
      <span className="ml-auto hidden min-w-0 truncate font-mono text-[9px] uppercase tracking-wide text-amber-200/80 sm:inline">
        {tf('symbolSimulated', { symbol: selectedSymbol })}
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
  className?: string;
}) {
  const open = props.open === props.id;
  return (
    <div className={cn('relative shrink-0', props.className)}>
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
