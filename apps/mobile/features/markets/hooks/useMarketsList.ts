import { useMemo } from 'react';
import { useMarketDataStore } from '@core/state/marketDataStore';
import {
  filterByQuote,
  filterByTab,
  searchMarkets,
  sortMarkets,
} from '@core/domain/markets/marketUtils';
import { applyLiveTicker } from '@core/domain/markets/formatPrice';
import type { MarketListItem, MarketSortKey, MarketTab } from '@exchange/mobile-types';

type Options = {
  items: MarketListItem[];
  tab: MarketTab;
  favorites: string[];
  quote: string | null;
  sortKey: MarketSortKey;
  sortDir?: 'asc' | 'desc';
  search?: string;
};

export function useMarketsList({
  items,
  tab,
  favorites,
  quote,
  sortKey,
  sortDir = 'desc',
  search = '',
}: Options) {
  const live = useMarketDataStore((s) => s.live);

  return useMemo(() => {
    let list = items.map((i) => applyLiveTicker(i, live[i.symbol] ?? {}));
    list = filterByQuote(list, quote);
    if (search) list = searchMarkets(list, search);
    else list = filterByTab(list, tab, favorites);
    return sortMarkets(list, sortKey, sortDir);
  }, [items, tab, favorites, quote, sortKey, sortDir, search, live]);
}
