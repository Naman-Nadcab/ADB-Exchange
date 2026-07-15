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
  tab: 'favorites' | 'all' | 'gainers' | 'losers' | 'trending' | 'new',
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
    case 'new':
      return newListings(items);
    default:
      return items;
  }
}

export function newListings(items: MarketListItem[], limit = 50): MarketListItem[] {
  return [...items]
    .sort((a, b) => {
      const ta = Date.parse(a.listedAt ?? '1970-01-01');
      const tb = Date.parse(b.listedAt ?? '1970-01-01');
      if (ta !== tb) return tb - ta;
      return b.symbol.localeCompare(a.symbol);
    })
    .slice(0, limit);
}

export function sortMarkets(
  items: MarketListItem[],
  sortKey: 'volume' | 'change' | 'name' | 'price' | 'change7d' | 'marketCap',
  direction: 'asc' | 'desc' = 'desc',
): MarketListItem[] {
  const sorted = [...items].sort((a, b) => {
    switch (sortKey) {
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'change':
        return b.changePct - a.changePct;
      case 'change7d':
        return (b.change7dPct ?? 0) - (a.change7dPct ?? 0);
      case 'marketCap':
        return (b.marketCap ?? 0) - (a.marketCap ?? 0);
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

export function newListingsPreview(items: MarketListItem[], limit = 5): MarketListItem[] {
  return newListings(items, limit);
}

export function aggregateMarketStats(items: MarketListItem[]) {
  const totalVolume = items.reduce((sum, i) => sum + i.volume24h, 0);
  const gainers = items.filter((i) => i.changePct > 0).length;
  const losers = items.filter((i) => i.changePct < 0).length;
  return { totalVolume, pairsCount: items.length, gainers, losers };
}

export function popularMarkets(items: MarketListItem[], limit = 8): MarketListItem[] {
  return trending(items, limit);
}

export function relatedPairs(items: MarketListItem[], symbol: string, limit = 6): MarketListItem[] {
  const target = items.find((i) => normalizeSymbol(i.symbol) === normalizeSymbol(symbol));
  if (!target) return trending(items, limit);
  const sameQuote = items.filter(
    (i) => i.quoteAsset === target.quoteAsset && normalizeSymbol(i.symbol) !== normalizeSymbol(symbol),
  );
  const sameBase = items.filter(
    (i) => i.baseAsset === target.baseAsset && normalizeSymbol(i.symbol) !== normalizeSymbol(symbol),
  );
  const merged = [...sameQuote, ...sameBase];
  const seen = new Set<string>();
  const unique: MarketListItem[] = [];
  for (const item of merged) {
    if (seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    unique.push(item);
  }
  if (unique.length < limit) {
    for (const item of trending(items, limit * 2)) {
      if (normalizeSymbol(item.symbol) === normalizeSymbol(symbol) || seen.has(item.symbol)) continue;
      seen.add(item.symbol);
      unique.push(item);
      if (unique.length >= limit) break;
    }
  }
  return unique.slice(0, limit);
}

export function marketPulse(items: MarketListItem[]) {
  if (!items.length) return { bullishPct: 50, bearishPct: 50 };
  const bullish = items.filter((i) => i.changePct > 0).length;
  const bullishPct = Math.round((bullish / items.length) * 100);
  return { bullishPct, bearishPct: 100 - bullishPct };
}

export function heatmapRows(items: MarketListItem[], limit = 18) {
  return [...items]
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, limit);
}
