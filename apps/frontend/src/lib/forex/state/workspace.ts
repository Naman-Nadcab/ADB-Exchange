import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ForexOrderType, ForexWorkspaceId } from '../models/types';

const STORAGE_KEY = 'eda-forex-workspace-v5';
const LEGACY_KEY = 'eda-forex-workspace-v4';
const PROFILES_KEY = 'eda-forex-workspace-profiles-v1';
const TEMPLATES_KEY = 'eda-forex-chart-templates-v1';

export type ForexChartMode = 'normal' | 'expand' | 'fullscreen';
export type ForexChartLayout = '1' | '2h' | '2v' | '2x2' | '2x3' | '3x3';
export type ForexLinkGroup = 'none' | 'A' | 'B';
export type ForexBottomTab =
  | 'positions'
  | 'orders'
  | 'fills'
  | 'history'
  | 'risk'
  | 'analytics'
  | 'alerts'
  | 'dom'
  | 'tape'
  | 'news'
  | 'calendar'
  | 'journal';
export type ForexMwFilter = 'all' | 'favorites' | 'fx_major' | 'fx_cross' | 'metal';

export interface ForexChartSlot {
  id: string;
  symbol: string;
  timeframe: string;
  linkGroup: ForexLinkGroup;
}

export interface ForexPanelVisibility {
  watchlist: boolean;
  chart: boolean;
  ticket: boolean;
  positions: boolean;
  orders: boolean;
  history: boolean;
  risk: boolean;
}

export interface ForexWorkspaceProfile {
  id: string;
  name: string;
  savedAt: string;
  snapshot: ForexWorkspaceSnapshot;
}

export interface ForexWorkspaceSnapshot {
  selectedSymbol: string;
  watchlist: string[];
  favorites?: string[];
  mwFilter?: ForexMwFilter;
  panels: ForexPanelVisibility;
  watchlistWidth: number;
  ticketWidth: number;
  bottomHeight: number;
  bottomCollapsed: boolean;
  chartLayout: ForexChartLayout;
  charts: ForexChartSlot[];
  activeChartId: string;
  chartTimeframe: string;
  bottomTab: ForexBottomTab;
  linkTimeframe?: boolean;
  oneClickAcked: boolean;
}

export interface ForexChartTemplate {
  id: string;
  name: string;
  study: string;
  showRsi: boolean;
  showMacd: boolean;
  showSessions: boolean;
  showLevels: boolean;
  chartType: string;
  savedAt: string;
}

export interface ForexWorkspaceState {
  workspace: ForexWorkspaceId;
  selectedSymbol: string;
  watchlist: string[];
  favorites: string[];
  mwFilter: ForexMwFilter;
  panels: ForexPanelVisibility;
  watchlistWidth: number;
  ticketWidth: number;
  bottomHeight: number;
  bottomCollapsed: boolean;
  bottomTab: ForexBottomTab;
  chartMode: ForexChartMode;
  chartTimeframe: string;
  chartLayout: ForexChartLayout;
  charts: ForexChartSlot[];
  activeChartId: string;
  maximizedChartId: string | null;
  layoutBeforeMaximize: ForexChartLayout | null;
  linkTimeframe: boolean;
  oneClickEnabled: boolean;
  oneClickAcked: boolean;
  /** Chart → ticket draft. Not persisted. */
  ticketDraft: {
    nonce: number;
    price?: string;
    limitPrice?: string;
    sl?: string;
    tp?: string;
    volume?: string;
    side?: 'buy' | 'sell';
    orderType?: ForexOrderType;
  } | null;
  setWorkspace: (w: ForexWorkspaceId) => void;
  setSelectedSymbol: (symbol: string) => void;
  /** Watchlist/Market focus — updates active chart (+ linked group) and ticket symbol. */
  focusSymbol: (symbol: string) => void;
  applyDeepLink: (symbol?: string | null, timeframe?: string | null) => void;
  setWatchlist: (symbols: string[]) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
  setMwFilter: (f: ForexMwFilter) => void;
  setPanel: (key: keyof ForexPanelVisibility, visible: boolean) => void;
  setWatchlistWidth: (n: number) => void;
  setTicketWidth: (n: number) => void;
  setBottomHeight: (n: number) => void;
  setBottomCollapsed: (collapsed: boolean) => void;
  toggleBottomCollapsed: () => void;
  setBottomTab: (tab: ForexBottomTab) => void;
  setChartMode: (mode: ForexChartMode) => void;
  setChartTimeframe: (tf: string) => void;
  setChartLayout: (layout: ForexChartLayout) => void;
  setActiveChartId: (id: string) => void;
  updateChartSlot: (id: string, patch: Partial<Pick<ForexChartSlot, 'symbol' | 'timeframe' | 'linkGroup'>>) => void;
  setLinkTimeframe: (on: boolean) => void;
  addChart: (symbol?: string) => void;
  removeChart: (id: string) => void;
  duplicateChart: (id: string) => void;
  maximizeChart: (id: string) => void;
  restoreMaximizedChart: () => void;
  setOneClickEnabled: (on: boolean) => void;
  setOneClickAcked: (acked: boolean) => void;
  setTicketDraft: (draft: ForexWorkspaceState['ticketDraft']) => void;
  applySnapshot: (snap: ForexWorkspaceSnapshot) => void;
  captureSnapshot: () => ForexWorkspaceSnapshot;
}

const DEFAULT_WATCHLIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD'];

function makeCharts(): ForexChartSlot[] {
  return [
    { id: 'c1', symbol: 'EURUSD', timeframe: '15m', linkGroup: 'A' },
    { id: 'c2', symbol: 'EURUSD', timeframe: '1h', linkGroup: 'A' },
    { id: 'c3', symbol: 'GBPUSD', timeframe: '15m', linkGroup: 'none' },
    { id: 'c4', symbol: 'XAUUSD', timeframe: '1h', linkGroup: 'none' },
    { id: 'c5', symbol: 'USDJPY', timeframe: '15m', linkGroup: 'none' },
    { id: 'c6', symbol: 'USDCHF', timeframe: '1h', linkGroup: 'none' },
    { id: 'c7', symbol: 'EURGBP', timeframe: '15m', linkGroup: 'none' },
    { id: 'c8', symbol: 'EURJPY', timeframe: '1h', linkGroup: 'none' },
    { id: 'c9', symbol: 'XAGUSD', timeframe: '15m', linkGroup: 'none' },
  ];
}

const DEFAULT_PANELS: ForexPanelVisibility = {
  watchlist: true,
  chart: true,
  ticket: true,
  positions: true,
  orders: true,
  history: true,
  risk: true,
};

export const FOREX_BOTTOM_COMPACT_H = 36;
export const FOREX_BOTTOM_EXPANDED_MIN = 140;
export const FOREX_BOTTOM_EXPANDED_MAX = 420;
export const FOREX_WATCHLIST_MIN = 180;
export const FOREX_WATCHLIST_MAX = 360;
export const FOREX_TICKET_MIN = 220;
export const FOREX_TICKET_MAX = 360;

export function layoutChartCount(layout: ForexChartLayout): number {
  switch (layout) {
    case '1':
      return 1;
    case '2h':
    case '2v':
      return 2;
    case '2x2':
      return 4;
    case '2x3':
      return 6;
    case '3x3':
      return 9;
    default:
      return 1;
  }
}

export function resolveForexBottomHeight(args: {
  chartMode: ForexChartMode;
  bottomCollapsed: boolean;
  preferredHeight: number;
}): number {
  if (args.chartMode === 'fullscreen') return 0;
  if (args.chartMode === 'expand') return FOREX_BOTTOM_COMPACT_H;
  if (args.bottomCollapsed) return FOREX_BOTTOM_COMPACT_H;
  return Math.min(FOREX_BOTTOM_EXPANDED_MAX, Math.max(FOREX_BOTTOM_EXPANDED_MIN, args.preferredHeight));
}

export function chartsVisibleForLayout(layout: ForexChartLayout, charts: ForexChartSlot[]): ForexChartSlot[] {
  return charts.slice(0, layoutChartCount(layout));
}

export function gridClassForLayout(layout: ForexChartLayout): string {
  switch (layout) {
    case '1':
      return 'grid-cols-1 grid-rows-1';
    case '2h':
      return 'grid-cols-2 grid-rows-1';
    case '2v':
      return 'grid-cols-1 grid-rows-2';
    case '2x2':
      return 'grid-cols-2 grid-rows-2';
    case '2x3':
      return 'grid-cols-3 grid-rows-2';
    case '3x3':
      return 'grid-cols-3 grid-rows-3';
    default:
      return 'grid-cols-1 grid-rows-1';
  }
}

function migrateLegacyCharts(raw: unknown): ForexChartSlot[] {
  const base = makeCharts();
  if (!Array.isArray(raw) || raw.length === 0) return base;
  const mapped = raw.map((c, i) => {
    const row = c as Partial<ForexChartSlot>;
    return {
      id: String(row.id ?? `c${i + 1}`),
      symbol: String(row.symbol ?? base[i]?.symbol ?? 'EURUSD')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase(),
      timeframe: String(row.timeframe ?? base[i]?.timeframe ?? '15m'),
      linkGroup: (row.linkGroup === 'A' || row.linkGroup === 'B' ? row.linkGroup : 'none') as ForexLinkGroup,
    };
  });
  const ids = new Set(mapped.map((c) => c.id));
  for (const slot of base) {
    if (!ids.has(slot.id)) mapped.push(slot);
  }
  return mapped.slice(0, 9);
}

function readLegacyV4(): Partial<ForexWorkspaceSnapshot> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const s = parsed.state ?? (parsed as Record<string, unknown>);
    if (!s || typeof s !== 'object') return null;
    return {
      selectedSymbol: typeof s.selectedSymbol === 'string' ? s.selectedSymbol : undefined,
      watchlist: Array.isArray(s.watchlist) ? (s.watchlist as string[]) : undefined,
      panels: s.panels as ForexPanelVisibility | undefined,
      watchlistWidth: typeof s.watchlistWidth === 'number' ? s.watchlistWidth : undefined,
      ticketWidth: typeof s.ticketWidth === 'number' ? s.ticketWidth : undefined,
      bottomHeight: typeof s.bottomHeight === 'number' ? s.bottomHeight : undefined,
      bottomCollapsed: typeof s.bottomCollapsed === 'boolean' ? s.bottomCollapsed : undefined,
      chartLayout: (typeof s.chartLayout === 'string' ? s.chartLayout : '1') as ForexChartLayout,
      charts: migrateLegacyCharts(s.charts),
      activeChartId: typeof s.activeChartId === 'string' ? s.activeChartId : undefined,
      chartTimeframe: typeof s.chartTimeframe === 'string' ? s.chartTimeframe : undefined,
      oneClickAcked: typeof s.oneClickAcked === 'boolean' ? s.oneClickAcked : undefined,
    };
  } catch {
    return null;
  }
}

export function listWorkspaceProfiles(): ForexWorkspaceProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForexWorkspaceProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaceProfile(name: string, snapshot: ForexWorkspaceSnapshot): ForexWorkspaceProfile {
  const profile: ForexWorkspaceProfile = {
    id: `wp_${Date.now().toString(36)}`,
    name: name.trim() || 'My Workspace',
    savedAt: new Date().toISOString(),
    snapshot,
  };
  const next = [profile, ...listWorkspaceProfiles().filter((p) => p.name !== profile.name)].slice(0, 12);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  return profile;
}

export function deleteWorkspaceProfile(id: string): void {
  const next = listWorkspaceProfiles().filter((p) => p.id !== id);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
}

export function listChartTemplates(): ForexChartTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForexChartTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChartTemplate(t: Omit<ForexChartTemplate, 'id' | 'savedAt'>): ForexChartTemplate {
  const row: ForexChartTemplate = {
    ...t,
    id: `ct_${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  };
  const next = [row, ...listChartTemplates().filter((x) => x.name !== row.name)].slice(0, 16);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  return row;
}

export function deleteChartTemplate(id: string): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(listChartTemplates().filter((t) => t.id !== id)));
}

export const useForexWorkspaceStore = create<ForexWorkspaceState>()(
  persist(
    (set, get) => ({
      workspace: 'trading',
      selectedSymbol: 'EURUSD',
      watchlist: DEFAULT_WATCHLIST,
      favorites: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      mwFilter: 'all',
      panels: DEFAULT_PANELS,
      watchlistWidth: 228,
      ticketWidth: 236,
      bottomHeight: 160,
      bottomCollapsed: true,
      bottomTab: 'positions',
      chartMode: 'normal',
      chartTimeframe: '15m',
      chartLayout: '1',
      charts: makeCharts(),
      activeChartId: 'c1',
      maximizedChartId: null,
      layoutBeforeMaximize: null,
      linkTimeframe: false,
      oneClickEnabled: false,
      oneClickAcked: false,
      ticketDraft: null,
      setWorkspace: (workspace) => set({ workspace }),
      setSelectedSymbol: (selectedSymbol) =>
        set({ selectedSymbol: selectedSymbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }),
      focusSymbol: (raw) => {
        const symbol = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const { activeChartId, charts, chartLayout, maximizedChartId } = get();
        const layout = maximizedChartId ? '1' : chartLayout;
        const visible = chartsVisibleForLayout(layout, charts);
        const active = visible.find((c) => c.id === activeChartId) ?? visible[0];
        const group = active?.linkGroup ?? 'none';
        const next = charts.map((c) => {
          if (group !== 'none' && c.linkGroup === group) return { ...c, symbol };
          if (c.id === (active?.id ?? activeChartId)) return { ...c, symbol };
          return c;
        });
        set({
          selectedSymbol: symbol,
          charts: next,
          activeChartId: active?.id ?? activeChartId,
          chartTimeframe: active?.timeframe ?? get().chartTimeframe,
        });
      },
      applyDeepLink: (rawSymbol, rawTf) => {
        const symbol = rawSymbol
          ? String(rawSymbol)
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase()
          : null;
        const timeframe = rawTf ? String(rawTf).trim() : null;
        if (symbol) get().focusSymbol(symbol);
        if (timeframe) {
          const { activeChartId, charts, linkTimeframe } = get();
          const active = charts.find((c) => c.id === activeChartId);
          const group = active?.linkGroup ?? 'none';
          set({
            chartTimeframe: timeframe,
            charts: charts.map((c) => {
              if (c.id === activeChartId) return { ...c, timeframe };
              if (linkTimeframe && group !== 'none' && c.linkGroup === group) return { ...c, timeframe };
              return c;
            }),
          });
        }
      },
      setWatchlist: (watchlist) => set({ watchlist }),
      toggleWatchlistSymbol: (symbol) => {
        const s = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cur = get().watchlist;
        set({ watchlist: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
      },
      toggleFavorite: (symbol) => {
        const s = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cur = get().favorites;
        set({ favorites: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
      },
      setMwFilter: (mwFilter) => set({ mwFilter }),
      setPanel: (key, visible) => set({ panels: { ...get().panels, [key]: visible } }),
      setWatchlistWidth: (watchlistWidth) =>
        set({ watchlistWidth: Math.min(FOREX_WATCHLIST_MAX, Math.max(FOREX_WATCHLIST_MIN, watchlistWidth)) }),
      setTicketWidth: (ticketWidth) =>
        set({ ticketWidth: Math.min(FOREX_TICKET_MAX, Math.max(FOREX_TICKET_MIN, ticketWidth)) }),
      setBottomHeight: (bottomHeight) =>
        set({
          bottomHeight: Math.min(FOREX_BOTTOM_EXPANDED_MAX, Math.max(FOREX_BOTTOM_EXPANDED_MIN, bottomHeight)),
        }),
      setBottomCollapsed: (bottomCollapsed) => set({ bottomCollapsed }),
      toggleBottomCollapsed: () => set({ bottomCollapsed: !get().bottomCollapsed }),
      setBottomTab: (bottomTab) => set({ bottomTab }),
      setChartMode: (chartMode) => set({ chartMode }),
      setChartTimeframe: (chartTimeframe) => {
        const { activeChartId, charts } = get();
        set({
          chartTimeframe,
          charts: charts.map((c) => (c.id === activeChartId ? { ...c, timeframe: chartTimeframe } : c)),
        });
      },
      setChartLayout: (chartLayout) =>
        set({
          chartLayout,
          maximizedChartId: null,
          layoutBeforeMaximize: null,
        }),
      setActiveChartId: (activeChartId) => {
        const slot = get().charts.find((c) => c.id === activeChartId);
        set({
          activeChartId,
          selectedSymbol: slot?.symbol ?? get().selectedSymbol,
          chartTimeframe: slot?.timeframe ?? get().chartTimeframe,
        });
      },
      updateChartSlot: (id, patch) => {
        const state = get();
        let charts = state.charts.map((c) => (c.id === id ? { ...c, ...patch } : c));
        const slot = charts.find((c) => c.id === id);
        if (slot && patch.timeframe && state.linkTimeframe && slot.linkGroup !== 'none') {
          charts = charts.map((c) =>
            c.linkGroup === slot.linkGroup ? { ...c, timeframe: patch.timeframe as string } : c
          );
        }
        if (slot && patch.symbol && slot.linkGroup !== 'none') {
          charts = charts.map((c) =>
            c.linkGroup === slot.linkGroup ? { ...c, symbol: patch.symbol as string } : c
          );
        }
        const active = charts.find((c) => c.id === state.activeChartId);
        set({
          charts,
          ...(active && active.id === id
            ? {
                selectedSymbol: active.symbol,
                chartTimeframe: active.timeframe,
              }
            : {}),
        });
      },
      setLinkTimeframe: (linkTimeframe) => set({ linkTimeframe }),
      addChart: (symbol) => {
        const { charts, chartLayout, selectedSymbol, chartTimeframe, activeChartId } = get();
        const used = new Set(charts.map((c) => c.id));
        let nextId = '';
        for (let i = 1; i <= 9; i++) {
          if (!used.has(`c${i}`)) {
            nextId = `c${i}`;
            break;
          }
        }
        if (!nextId) return;
        const slot: ForexChartSlot = {
          id: nextId,
          symbol: (symbol ?? selectedSymbol).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
          timeframe: chartTimeframe,
          linkGroup: 'none',
        };
        const nextCharts = [...charts, slot].slice(0, 9);
        const n = nextCharts.length;
        let layout = chartLayout;
        if (n <= 1) layout = '1';
        else if (n === 2) layout = chartLayout === '2v' ? '2v' : '2h';
        else if (n <= 4) layout = '2x2';
        else if (n <= 6) layout = '2x3';
        else layout = '3x3';
        set({ charts: nextCharts, chartLayout: layout, activeChartId: nextId || activeChartId });
      },
      removeChart: (id) => {
        const { charts, activeChartId, chartLayout } = get();
        if (charts.length <= 1) return;
        const nextCharts = charts.filter((c) => c.id !== id);
        if (nextCharts.length === 0) return;
        const n = nextCharts.length;
        let layout = chartLayout;
        if (n === 1) layout = '1';
        else if (n === 2) layout = chartLayout === '2v' ? '2v' : '2h';
        else if (n <= 4) layout = n <= 2 ? layout : '2x2';
        else if (n <= 6) layout = '2x3';
        else layout = '3x3';
        const nextActive = activeChartId === id ? nextCharts[0].id : activeChartId;
        set({
          charts: nextCharts,
          chartLayout: layout,
          activeChartId: nextActive,
          maximizedChartId: null,
          layoutBeforeMaximize: null,
        });
      },
      duplicateChart: (id) => {
        const src = get().charts.find((c) => c.id === id);
        if (!src) return;
        get().addChart(src.symbol);
        const { charts, activeChartId } = get();
        const created = charts.find((c) => c.id === activeChartId);
        if (created) {
          get().updateChartSlot(created.id, { timeframe: src.timeframe, linkGroup: 'none' });
        }
      },
      maximizeChart: (id) => {
        const { chartLayout, maximizedChartId, layoutBeforeMaximize } = get();
        if (maximizedChartId === id) {
          get().restoreMaximizedChart();
          return;
        }
        set({
          maximizedChartId: id,
          layoutBeforeMaximize: maximizedChartId ? layoutBeforeMaximize : chartLayout,
          activeChartId: id,
          chartLayout: '1',
        });
        const slot = get().charts.find((c) => c.id === id);
        if (slot) {
          set({ selectedSymbol: slot.symbol, chartTimeframe: slot.timeframe });
        }
      },
      restoreMaximizedChart: () => {
        const { layoutBeforeMaximize } = get();
        set({
          maximizedChartId: null,
          chartLayout: layoutBeforeMaximize ?? get().chartLayout,
          layoutBeforeMaximize: null,
          chartMode: 'normal',
        });
      },
      setOneClickEnabled: (oneClickEnabled) => set({ oneClickEnabled }),
      setOneClickAcked: (oneClickAcked) => set({ oneClickAcked }),
      setTicketDraft: (ticketDraft) => set({ ticketDraft }),
      captureSnapshot: () => {
        const s = get();
        return {
          selectedSymbol: s.selectedSymbol,
          watchlist: s.watchlist,
          favorites: s.favorites,
          mwFilter: s.mwFilter,
          panels: s.panels,
          watchlistWidth: s.watchlistWidth,
          ticketWidth: s.ticketWidth,
          bottomHeight: s.bottomHeight,
          bottomCollapsed: s.bottomCollapsed,
          chartLayout: s.layoutBeforeMaximize ?? s.chartLayout,
          charts: s.charts,
          activeChartId: s.activeChartId,
          chartTimeframe: s.chartTimeframe,
          bottomTab: s.bottomTab,
          linkTimeframe: s.linkTimeframe,
          oneClickAcked: s.oneClickAcked,
        };
      },
      applySnapshot: (snap) => {
        set({
          selectedSymbol: snap.selectedSymbol,
          watchlist: snap.watchlist,
          favorites: snap.favorites ?? get().favorites,
          mwFilter: snap.mwFilter ?? 'all',
          panels: snap.panels,
          watchlistWidth: snap.watchlistWidth,
          ticketWidth: snap.ticketWidth,
          bottomHeight: snap.bottomHeight,
          bottomCollapsed: snap.bottomCollapsed,
          chartLayout: snap.chartLayout,
          charts: migrateLegacyCharts(snap.charts),
          activeChartId: snap.activeChartId,
          chartTimeframe: snap.chartTimeframe,
          bottomTab: snap.bottomTab ?? 'positions',
          linkTimeframe: snap.linkTimeframe ?? false,
          oneClickAcked: snap.oneClickAcked,
          maximizedChartId: null,
          layoutBeforeMaximize: null,
          chartMode: 'normal',
          oneClickEnabled: false,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return {
          getItem: (name) => {
            const cur = localStorage.getItem(name);
            if (cur) return cur;
            const legacy = readLegacyV4();
            if (!legacy) return null;
            return JSON.stringify({
              state: {
                workspace: 'trading',
                selectedSymbol: legacy.selectedSymbol ?? 'EURUSD',
                watchlist: legacy.watchlist ?? DEFAULT_WATCHLIST,
                panels: legacy.panels ?? DEFAULT_PANELS,
                watchlistWidth: legacy.watchlistWidth ?? 240,
                ticketWidth: legacy.ticketWidth ?? 260,
                bottomHeight: legacy.bottomHeight ?? 180,
                bottomCollapsed: legacy.bottomCollapsed ?? false,
                bottomTab: 'positions',
                chartMode: 'normal',
                chartTimeframe: legacy.chartTimeframe ?? '15m',
                chartLayout: legacy.chartLayout ?? '1',
                charts: legacy.charts ?? makeCharts(),
                activeChartId: legacy.activeChartId ?? 'c1',
                oneClickAcked: legacy.oneClickAcked ?? false,
              },
              version: 0,
            });
          },
          setItem: (name, value) => localStorage.setItem(name, value),
          removeItem: (name) => localStorage.removeItem(name),
        };
      }),
      partialize: (s) => ({
        workspace: s.workspace,
        selectedSymbol: s.selectedSymbol,
        watchlist: s.watchlist,
        favorites: s.favorites,
        mwFilter: s.mwFilter,
        panels: s.panels,
        watchlistWidth: s.watchlistWidth,
        ticketWidth: s.ticketWidth,
        bottomHeight: s.bottomHeight,
        bottomCollapsed: s.bottomCollapsed,
        bottomTab: s.bottomTab,
        chartMode: s.chartMode === 'fullscreen' ? 'normal' : s.chartMode,
        chartTimeframe: s.chartTimeframe,
        chartLayout: s.maximizedChartId ? s.layoutBeforeMaximize ?? s.chartLayout : s.chartLayout,
        charts: s.charts,
        activeChartId: s.activeChartId,
        linkTimeframe: s.linkTimeframe,
        oneClickAcked: s.oneClickAcked,
      }),
    }
  )
);
