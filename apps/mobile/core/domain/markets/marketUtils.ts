import type { SpotTicker, MarketListItem } from '@exchange/mobile-types';

export function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/-/g, '_');
}

export function parseNum(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function tickerToListItem(t: SpotTicker): MarketListItem {
  return {
    symbol: normalizeSymbol(t.symbol),
    baseAsset: t.base_asset,
    quoteAsset: t.quote_asset,
    lastPrice: parseNum(t.last_price),
    changePct: parseNum(t.change_pct),
    volume24h: parseNum(t.volume_24h),
    high24h: parseNum(t.high_24h),
    low24h: parseNum(t.low_24h),
  };
}

export function mergeTickers(tickers: SpotTicker[]): MarketListItem[] {
  return tickers.map(tickerToListItem);
}

export function filterByQuote(items: MarketListItem[], quote: string | null): MarketListItem[] {
  if (!quote) return items;
  return items.filter((i) => i.quoteAsset === quote);
}

export function filterByTab(
  items: MarketListItem[],
  tab: 'favorites' | 'all' | 'gainers' | 'losers' | 'trending',
  favorites: string[],
): MarketListItem[] {
  switch (tab) {
    case 'favorites':
      return items.filter((i) => favorites.includes(i.symbol));
    case 'gainers':
      return [...items].sort((a, b) => b.changePct - a.changePct).filter((i) => i.changePct > 0);
    case 'losers':
      return [...items].sort((a, b) => a.changePct - b.changePct).filter((i) => i.changePct < 0);
    case 'trending':
      return [...items].sort((a, b) => b.volume24h - a.volume24h).slice(0, 50);
    default:
      return items;
  }
}

export function sortMarkets(
  items: MarketListItem[],
  sortKey: 'volume' | 'change' | 'name' | 'price',
  direction: 'asc' | 'desc' = 'desc',
): MarketListItem[] {
  const sorted = [...items].sort((a, b) => {
    switch (sortKey) {
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'change':
        return b.changePct - a.changePct;
      case 'name':
        return a.baseAsset.localeCompare(b.baseAsset);
      case 'price':
        return b.lastPrice - a.lastPrice;
      default:
        return 0;
    }
  });
  return direction === 'asc' ? sorted.reverse() : sorted;
}

export function searchMarkets(items: MarketListItem[], query: string): MarketListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (i) =>
      i.symbol.toLowerCase().includes(q) ||
      i.baseAsset.toLowerCase().includes(q) ||
      i.quoteAsset.toLowerCase().includes(q),
  );
}

export function topGainers(items: MarketListItem[], limit = 5): MarketListItem[] {
  return [...items].sort((a, b) => b.changePct - a.changePct).slice(0, limit);
}

export function topLosers(items: MarketListItem[], limit = 5): MarketListItem[] {
  return [...items].sort((a, b) => a.changePct - b.changePct).slice(0, limit);
}

export function trending(items: MarketListItem[], limit = 5): MarketListItem[] {
  return [...items].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);
}
