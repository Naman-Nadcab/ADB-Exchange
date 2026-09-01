import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ForexWorkspaceId } from '../models/types';

const STORAGE_KEY = 'eda-forex-workspace-v1';

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
  chartTimeframe: string;
  setWorkspace: (w: ForexWorkspaceId) => void;
  setSelectedSymbol: (symbol: string) => void;
  setWatchlist: (symbols: string[]) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  setPanel: (key: keyof ForexPanelVisibility, visible: boolean) => void;
  setWatchlistWidth: (n: number) => void;
  setTicketWidth: (n: number) => void;
  setBottomHeight: (n: number) => void;
  setChartTimeframe: (tf: string) => void;
}

const DEFAULT_WATCHLIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

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
      watchlistWidth: 280,
      ticketWidth: 320,
      bottomHeight: 220,
      chartTimeframe: '1m',
      setWorkspace: (workspace) => set({ workspace }),
      setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol: selectedSymbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }),
      setWatchlist: (watchlist) => set({ watchlist }),
      toggleWatchlistSymbol: (symbol) => {
        const s = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cur = get().watchlist;
        set({ watchlist: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
      },
      setPanel: (key, visible) => set({ panels: { ...get().panels, [key]: visible } }),
      setWatchlistWidth: (watchlistWidth) => set({ watchlistWidth }),
      setTicketWidth: (ticketWidth) => set({ ticketWidth }),
      setBottomHeight: (bottomHeight) => set({ bottomHeight }),
      setChartTimeframe: (chartTimeframe) => set({ chartTimeframe }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } : localStorage)),
      partialize: (s) => ({
        workspace: s.workspace,
        selectedSymbol: s.selectedSymbol,
        watchlist: s.watchlist,
        panels: s.panels,
        watchlistWidth: s.watchlistWidth,
        ticketWidth: s.ticketWidth,
        bottomHeight: s.bottomHeight,
        chartTimeframe: s.chartTimeframe,
      }),
    }
  )
);
