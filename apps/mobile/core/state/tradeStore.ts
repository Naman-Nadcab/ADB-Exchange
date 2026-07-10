import { create } from 'zustand';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import type { OrderSide } from '@exchange/mobile-types';

const LAST_PAIR_KEY = 'trade.lastPair';
const LAST_SIDE_KEY = 'trade.side';

type TradeStore = {
  symbol: string;
  side: OrderSide;
  wsAuthenticated: boolean;
  setSymbol: (symbol: string) => void;
  setSide: (side: OrderSide) => void;
  setWsAuthenticated: (v: boolean) => void;
  hydrate: () => void;
};

export const useTradeStore = create<TradeStore>((set) => ({
  symbol: 'BTC_USDT',
  side: 'buy',
  wsAuthenticated: false,
  setSymbol: (symbol) => {
    mmkvStorage.set(LAST_PAIR_KEY, symbol);
    set({ symbol });
  },
  setSide: (side) => {
    mmkvStorage.set(LAST_SIDE_KEY, side);
    set({ side });
  },
  setWsAuthenticated: (wsAuthenticated) => set({ wsAuthenticated }),
  hydrate: () => {
    const symbol = mmkvStorage.getString(LAST_PAIR_KEY) ?? 'BTC_USDT';
    const side = (mmkvStorage.getString(LAST_SIDE_KEY) as OrderSide) ?? 'buy';
    set({ symbol, side });
  },
}));
