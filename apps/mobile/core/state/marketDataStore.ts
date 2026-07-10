import { create } from 'zustand';
import type { MarketListItem, OrderbookSnapshot, RecentTrade } from '@exchange/mobile-types';

const MAX_TRADES = 100;
const seenTradeIds = new Set<string>();
const MAX_SEEN = 1000;

type LiveTickers = Record<string, Partial<MarketListItem>>;

type MarketDataStore = {
  live: LiveTickers;
  orderbooks: Record<string, OrderbookSnapshot>;
  trades: Record<string, RecentTrade[]>;
  lastSeq: Record<string, number>;
  setLiveTicker: (symbol: string, patch: Partial<MarketListItem>) => void;
  setOrderbook: (symbol: string, book: OrderbookSnapshot) => void;
  appendTrades: (symbol: string, rows: RecentTrade[]) => void;
  getLastSeq: (symbol: string) => number | undefined;
  clearLive: () => void;
  clearSymbol: (symbol: string) => void;
};

function dedupeTrades(rows: RecentTrade[]): RecentTrade[] {
  const out: RecentTrade[] = [];
  for (const t of rows) {
    if (seenTradeIds.has(t.id)) continue;
    seenTradeIds.add(t.id);
    if (seenTradeIds.size > MAX_SEEN) {
      const first = seenTradeIds.values().next().value;
      if (first) seenTradeIds.delete(first);
    }
    out.push(t);
  }
  return out;
}

export const useMarketDataStore = create<MarketDataStore>((set, get) => ({
  live: {},
  orderbooks: {},
  trades: {},
  lastSeq: {},
  setLiveTicker: (symbol, patch) =>
    set((s) => ({
      live: { ...s.live, [symbol]: { ...s.live[symbol], ...patch, symbol } },
    })),
  setOrderbook: (symbol, book) =>
    set((s) => ({
      orderbooks: { ...s.orderbooks, [symbol]: book },
      lastSeq: { ...s.lastSeq, [symbol]: book.lastUpdateId ?? s.lastSeq[symbol] },
    })),
  appendTrades: (symbol, rows) => {
    const fresh = dedupeTrades(rows);
    if (!fresh.length) return;
    set((s) => {
      const prev = s.trades[symbol] ?? [];
      const merged = [...fresh, ...prev].slice(0, MAX_TRADES);
      return { trades: { ...s.trades, [symbol]: merged } };
    });
  },
  getLastSeq: (symbol) => get().lastSeq[symbol],
  clearLive: () => set({ live: {}, orderbooks: {}, trades: {}, lastSeq: {} }),
  clearSymbol: (symbol) =>
    set((s) => {
      const orderbooks = { ...s.orderbooks };
      const trades = { ...s.trades };
      const lastSeq = { ...s.lastSeq };
      delete orderbooks[symbol];
      delete trades[symbol];
      delete lastSeq[symbol];
      return { orderbooks, trades, lastSeq };
    }),
}));
