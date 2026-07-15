import { create } from 'zustand';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import type { AssetSort } from '@core/domain/wallet/portfolio';

const HIDE_SMALL_KEY = 'wallet.hideSmall';
const HIDDEN_KEY = 'wallet.hidden';
const FAVORITES_KEY = 'wallet.favorites';
const SORT_KEY = 'wallet.sort';
const SHOW_BALANCES_KEY = 'wallet.showBalances';

function loadSet(key: string): Set<string> {
  const raw = mmkvStorage.getString(key);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  mmkvStorage.set(key, JSON.stringify([...set]));
}

type WalletPrefsStore = {
  hideSmall: boolean;
  showBalances: boolean;
  hidden: Set<string>;
  favorites: Set<string>;
  sort: AssetSort;
  hydrate: () => void;
  setHideSmall: (v: boolean) => void;
  toggleShowBalances: () => void;
  toggleHidden: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
  setSort: (sort: AssetSort) => void;
};

export const useWalletPrefsStore = create<WalletPrefsStore>((set, get) => ({
  hideSmall: false,
  showBalances: true,
  hidden: new Set(),
  favorites: new Set(),
  sort: 'value',
  hydrate: () => {
    set({
      hideSmall: mmkvStorage.getString(HIDE_SMALL_KEY) === 'true',
      showBalances: mmkvStorage.getString(SHOW_BALANCES_KEY) !== 'false',
      hidden: loadSet(HIDDEN_KEY),
      favorites: loadSet(FAVORITES_KEY),
      sort: (mmkvStorage.getString(SORT_KEY) as AssetSort) ?? 'value',
    });
  },
  setHideSmall: (hideSmall) => {
    mmkvStorage.set(HIDE_SMALL_KEY, String(hideSmall));
    set({ hideSmall });
  },
  toggleShowBalances: () => {
    const showBalances = !get().showBalances;
    mmkvStorage.set(SHOW_BALANCES_KEY, String(showBalances));
    set({ showBalances });
  },
  toggleHidden: (symbol) => {
    const hidden = new Set(get().hidden);
    if (hidden.has(symbol)) hidden.delete(symbol);
    else hidden.add(symbol);
    saveSet(HIDDEN_KEY, hidden);
    set({ hidden });
  },
  toggleFavorite: (symbol) => {
    const favorites = new Set(get().favorites);
    if (favorites.has(symbol)) favorites.delete(symbol);
    else favorites.add(symbol);
    saveSet(FAVORITES_KEY, favorites);
    set({ favorites });
  },
  setSort: (sort) => {
    mmkvStorage.set(SORT_KEY, sort);
    set({ sort });
  },
}));
