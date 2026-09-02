import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ForexWorkspaceId } from '../models/types';

const STORAGE_KEY = 'eda-forex-workspace-v3';

export type ForexChartMode = 'normal' | 'expand' | 'fullscreen';

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
  /** Preferred expanded bottom height when trading data exists. */
  bottomHeight: number;
  bottomCollapsed: boolean;
  chartMode: ForexChartMode;
  chartTimeframe: string;
  /** Chart → ticket draft. Not persisted. */
  ticketDraft: { nonce: number; price?: string; sl?: string; tp?: string; volume?: string } | null;
  setWorkspace: (w: ForexWorkspaceId) => void;
  setSelectedSymbol: (symbol: string) => void;
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
  setTicketDraft: (draft: ForexWorkspaceState['ticketDraft']) => void;
}

const DEFAULT_WATCHLIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD'];

/** Compact tab strip when bottom has no rows or user collapsed it. */
export const FOREX_BOTTOM_COMPACT_H = 48;
/** Minimum expanded bottom when positions/orders exist. */
export const FOREX_BOTTOM_EXPANDED_MIN = 148;
export const FOREX_BOTTOM_EXPANDED_MAX = 280;

export function resolveForexBottomHeight(args: {
  chartMode: ForexChartMode;
  bottomCollapsed: boolean;
  preferredHeight: number;
}): number {
  if (args.chartMode === 'fullscreen') return 0;
  if (args.chartMode === 'expand') return FOREX_BOTTOM_COMPACT_H;
  if (args.bottomCollapsed) return FOREX_BOTTOM_COMPACT_H;
  return Math.min(
    FOREX_BOTTOM_EXPANDED_MAX,
    Math.max(FOREX_BOTTOM_EXPANDED_MIN, args.preferredHeight)
  );
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
      watchlistWidth: 236,
      ticketWidth: 276,
      bottomHeight: 168,
      /** Chart-first: collapsed until positions/orders appear or user expands. */
      bottomCollapsed: true,
      chartMode: 'normal',
      chartTimeframe: '15m',
      ticketDraft: null,
      setWorkspace: (workspace) => set({ workspace }),
      setSelectedSymbol: (selectedSymbol) =>
        set({ selectedSymbol: selectedSymbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }),
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
      setChartTimeframe: (chartTimeframe) => set({ chartTimeframe }),
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
      }),
    }
  )
);
