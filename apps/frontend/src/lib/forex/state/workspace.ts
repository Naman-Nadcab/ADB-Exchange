import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ForexWorkspaceId } from '../models/types';

const STORAGE_KEY = 'eda-forex-workspace-v4';

export type ForexChartMode = 'normal' | 'expand' | 'fullscreen';
export type ForexChartLayout = '1' | '2h' | '2v' | '2x2';
export type ForexLinkGroup = 'none' | 'A' | 'B';

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

export interface ForexWorkspaceState {
  workspace: ForexWorkspaceId;
  selectedSymbol: string;
  watchlist: string[];
  panels: ForexPanelVisibility;
  watchlistWidth: number;
  ticketWidth: number;
  bottomHeight: number;
  bottomCollapsed: boolean;
  chartMode: ForexChartMode;
  chartTimeframe: string;
  chartLayout: ForexChartLayout;
  charts: ForexChartSlot[];
  activeChartId: string;
  oneClickEnabled: boolean;
  oneClickAcked: boolean;
  /** Chart → ticket draft. Not persisted. */
  ticketDraft: {
    nonce: number;
    price?: string;
    sl?: string;
    tp?: string;
    volume?: string;
    side?: 'buy' | 'sell';
    orderType?: 'market' | 'limit' | 'stop';
  } | null;
  setWorkspace: (w: ForexWorkspaceId) => void;
  setSelectedSymbol: (symbol: string) => void;
  /** Watchlist/Market focus — updates active chart (+ linked group) and ticket symbol. */
  focusSymbol: (symbol: string) => void;
  setWatchlist: (symbols: string[]) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  setPanel: (key: keyof ForexPanelVisibility, visible: boolean) => void;
  setWatchlistWidth: (n: number) => void;
  setTicketWidth: (n: number) => void;
  setBottomHeight: (n: number) => void;
  setBottomCollapsed: (collapsed: boolean) => void;
  toggleBottomCollapsed: () => void;
  setChartMode: (mode: ForexChartMode) => void;
  setChartTimeframe: (tf: string) => void;
  setChartLayout: (layout: ForexChartLayout) => void;
  setActiveChartId: (id: string) => void;
  updateChartSlot: (id: string, patch: Partial<Pick<ForexChartSlot, 'symbol' | 'timeframe' | 'linkGroup'>>) => void;
  setOneClickEnabled: (on: boolean) => void;
  setOneClickAcked: (acked: boolean) => void;
  setTicketDraft: (draft: ForexWorkspaceState['ticketDraft']) => void;
}

const DEFAULT_WATCHLIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD'];

function makeCharts(): ForexChartSlot[] {
  return [
    { id: 'c1', symbol: 'EURUSD', timeframe: '15m', linkGroup: 'A' },
    { id: 'c2', symbol: 'EURUSD', timeframe: '1h', linkGroup: 'A' },
    { id: 'c3', symbol: 'GBPUSD', timeframe: '15m', linkGroup: 'none' },
    { id: 'c4', symbol: 'XAUUSD', timeframe: '1h', linkGroup: 'none' },
  ];
}

export const FOREX_BOTTOM_COMPACT_H = 48;
export const FOREX_BOTTOM_EXPANDED_MIN = 160;
export const FOREX_BOTTOM_EXPANDED_MAX = 320;

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
  const n = layout === '1' ? 1 : layout === '2h' || layout === '2v' ? 2 : 4;
  return charts.slice(0, n);
}

export const useForexWorkspaceStore = create<ForexWorkspaceState>()(
  persist(
    (set, get) => ({
      workspace: 'trading',
      selectedSymbol: 'EURUSD',
      watchlist: DEFAULT_WATCHLIST,
      panels: {
        watchlist: true,
        chart: true,
        ticket: true,
        positions: true,
        orders: true,
        history: true,
        risk: true,
      },
      watchlistWidth: 240,
      ticketWidth: 280,
      bottomHeight: 200,
      bottomCollapsed: false,
      chartMode: 'normal',
      chartTimeframe: '15m',
      chartLayout: '1',
      charts: makeCharts(),
      activeChartId: 'c1',
      oneClickEnabled: false,
      oneClickAcked: false,
      ticketDraft: null,
      setWorkspace: (workspace) => set({ workspace }),
      setSelectedSymbol: (selectedSymbol) =>
        set({ selectedSymbol: selectedSymbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }),
      focusSymbol: (raw) => {
        const symbol = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const { activeChartId, charts, chartLayout } = get();
        const visible = chartsVisibleForLayout(chartLayout, charts);
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
      setWatchlist: (watchlist) => set({ watchlist }),
      toggleWatchlistSymbol: (symbol) => {
        const s = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cur = get().watchlist;
        set({ watchlist: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
      },
      setPanel: (key, visible) => set({ panels: { ...get().panels, [key]: visible } }),
      setWatchlistWidth: (watchlistWidth) => set({ watchlistWidth: Math.min(360, Math.max(180, watchlistWidth)) }),
      setTicketWidth: (ticketWidth) => set({ ticketWidth: Math.min(360, Math.max(240, ticketWidth)) }),
      setBottomHeight: (bottomHeight) =>
        set({
          bottomHeight: Math.min(FOREX_BOTTOM_EXPANDED_MAX, Math.max(FOREX_BOTTOM_EXPANDED_MIN, bottomHeight)),
        }),
      setBottomCollapsed: (bottomCollapsed) => set({ bottomCollapsed }),
      toggleBottomCollapsed: () => set({ bottomCollapsed: !get().bottomCollapsed }),
      setChartMode: (chartMode) => set({ chartMode }),
      setChartTimeframe: (chartTimeframe) => {
        const { activeChartId, charts } = get();
        set({
          chartTimeframe,
          charts: charts.map((c) => (c.id === activeChartId ? { ...c, timeframe: chartTimeframe } : c)),
        });
      },
      setChartLayout: (chartLayout) => set({ chartLayout }),
      setActiveChartId: (activeChartId) => {
        const slot = get().charts.find((c) => c.id === activeChartId);
        set({
          activeChartId,
          selectedSymbol: slot?.symbol ?? get().selectedSymbol,
          chartTimeframe: slot?.timeframe ?? get().chartTimeframe,
        });
      },
      updateChartSlot: (id, patch) => {
        const charts = get().charts.map((c) => (c.id === id ? { ...c, ...patch } : c));
        const active = charts.find((c) => c.id === get().activeChartId);
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
      setOneClickEnabled: (oneClickEnabled) => set({ oneClickEnabled }),
      setOneClickAcked: (oneClickAcked) => set({ oneClickAcked }),
      setTicketDraft: (ticketDraft) => set({ ticketDraft }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : localStorage
      ),
      partialize: (s) => ({
        workspace: s.workspace,
        selectedSymbol: s.selectedSymbol,
        watchlist: s.watchlist,
        panels: s.panels,
        watchlistWidth: s.watchlistWidth,
        ticketWidth: s.ticketWidth,
        bottomHeight: s.bottomHeight,
        bottomCollapsed: s.bottomCollapsed,
        chartMode: s.chartMode === 'fullscreen' ? 'normal' : s.chartMode,
        chartTimeframe: s.chartTimeframe,
        chartLayout: s.chartLayout,
        charts: s.charts,
        activeChartId: s.activeChartId,
        oneClickAcked: s.oneClickAcked,
        // oneClickEnabled intentionally not persisted — always OFF until user enables
      }),
    }
  )
);
