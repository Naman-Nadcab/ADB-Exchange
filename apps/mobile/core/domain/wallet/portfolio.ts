import type { AssetBalance, MarketListItem, TradingBalance } from '@exchange/mobile-types';

export const HIDE_SMALL_USD_THRESHOLD = 1;

export type TopHolding = {
  symbol: string;
  amount: string;
  usd: number;
};

export type MergedAsset = {
  symbol: string;
  name: string;
  fundingTotal: string;
  fundingAvailable: string;
  fundingLocked: string;
  tradingEquity: string;
  usdValue: string;
  totalBalance: string;
};

export type AllocationSlice = {
  symbol: string;
  usdValue: number;
  pct: number;
};

export type AssetSort = 'value' | 'name' | 'symbol';
export type AssetFilters = {
  search: string;
  hideSmall: boolean;
  hidden: Set<string>;
  favorites: Set<string>;
  sort: AssetSort;
};

function parseUsd(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function mergeAssets(
  funding?: AssetBalance[],
  trading?: TradingBalance[],
): MergedAsset[] {
  const map = new Map<string, MergedAsset>();

  for (const b of funding ?? []) {
    map.set(b.symbol, {
      symbol: b.symbol,
      name: b.name,
      fundingTotal: b.total_balance,
      fundingAvailable: b.available_balance,
      fundingLocked: b.locked_balance,
      tradingEquity: '0',
      usdValue: b.usd_value,
      totalBalance: b.total_balance,
    });
  }

  for (const t of trading ?? []) {
    const prev = map.get(t.symbol);
    const equity = t.equity ?? t.wallet_balance ?? '0';
    if (prev) {
      prev.tradingEquity = equity;
      const total = parseFloat(prev.fundingTotal) + parseFloat(equity);
      prev.totalBalance = String(total);
    } else {
      map.set(t.symbol, {
        symbol: t.symbol,
        name: t.name ?? t.symbol,
        fundingTotal: '0',
        fundingAvailable: '0',
        fundingLocked: '0',
        tradingEquity: equity,
        usdValue: '0',
        totalBalance: equity,
      });
    }
  }

  return Array.from(map.values());
}

export function computeAllocation(assets: MergedAsset[]): AllocationSlice[] {
  const total = assets.reduce((s, a) => s + parseUsd(a.usdValue), 0);
  if (total <= 0) return [];
  return assets
    .filter((a) => parseUsd(a.usdValue) > 0)
    .map((a) => ({
      symbol: a.symbol,
      usdValue: parseUsd(a.usdValue),
      pct: (parseUsd(a.usdValue) / total) * 100,
    }))
    .sort((a, b) => b.usdValue - a.usdValue);
}

export function filterAssets(assets: MergedAsset[], filters: AssetFilters): MergedAsset[] {
  let out = assets.filter((a) => !filters.hidden.has(a.symbol));
  if (filters.hideSmall) {
    out = out.filter((a) => parseUsd(a.usdValue) >= HIDE_SMALL_USD_THRESHOLD);
  }
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    out = out.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }
  if (filters.favorites.size) {
    const fav = out.filter((a) => filters.favorites.has(a.symbol));
    const rest = out.filter((a) => !filters.favorites.has(a.symbol));
    out = [...fav, ...rest];
  }
  out.sort((a, b) => {
    if (filters.favorites.has(a.symbol) && !filters.favorites.has(b.symbol)) return -1;
    if (!filters.favorites.has(a.symbol) && filters.favorites.has(b.symbol)) return 1;
    if (filters.sort === 'name') return a.name.localeCompare(b.name);
    if (filters.sort === 'symbol') return a.symbol.localeCompare(b.symbol);
    return parseUsd(b.usdValue) - parseUsd(a.usdValue);
  });
  return out;
}

export function formatUsd(value: string | number, digits = 2): string {
  const n = typeof value === 'string' ? parseUsd(value) : value;
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compute24hChange(history: { total_usd: number }[]): number | null {
  if (history.length < 2) return null;
  const first = history[0].total_usd;
  const last = history[history.length - 1].total_usd;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

export type PeriodPnl = { amount: number; percent: number };

export function computePeriodPnl(history: { total_usd: number }[]): PeriodPnl | null {
  if (history.length < 2) return null;
  const first = history[0].total_usd;
  const last = history[history.length - 1].total_usd;
  return {
    amount: last - first,
    percent: first > 0 ? ((last - first) / first) * 100 : 0,
  };
}

export function maskBalance(value: string, showBalances: boolean): string {
  return showBalances ? value : '••••••';
}

export function priceByBaseFromMarkets(markets: MarketListItem[]): Record<string, number> {
  const prices: Record<string, number> = { USDT: 1, USDC: 1, DAI: 1 };
  for (const item of markets) {
    const base = item.baseAsset ?? item.symbol.split('_')[0];
    if (base && item.lastPrice > 0) prices[base] = item.lastPrice;
  }
  return prices;
}

export function changePctByBaseFromMarkets(markets: MarketListItem[]): Record<string, number> {
  const changes: Record<string, number> = {};
  for (const item of markets) {
    const base = item.baseAsset ?? item.symbol.split('_')[0];
    if (base) changes[base] = item.changePct;
  }
  return changes;
}

export function topFundingHoldings(balances: AssetBalance[], limit = 4): TopHolding[] {
  return balances
    .map((b) => ({
      symbol: b.symbol,
      amount: b.total_balance,
      usd: parseUsd(b.usd_value),
    }))
    .filter((h) => h.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit);
}

export function topTradingHoldings(
  balances: TradingBalance[],
  prices: Record<string, number>,
  limit = 4,
): TopHolding[] {
  return balances
    .map((b) => {
      const amount = parseFloat(b.equity ?? b.wallet_balance ?? '0');
      const price = prices[b.symbol] ?? 0;
      return { symbol: b.symbol, amount: String(amount), usd: amount * price };
    })
    .filter((h) => h.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit);
}

export type FundingSortKey = 'symbol' | 'balance' | 'value';
export type SortDirection = 'asc' | 'desc';

export const FUNDING_PAGE_SIZE = 25;

/** Mirrors website /wallet/unified hide-small rule (usd_value within ±$1). */
export function filterTradingBalances(
  balances: TradingBalance[],
  opts: { search: string; hideSmall: boolean },
): TradingBalance[] {
  const q = opts.search.trim().toLowerCase();
  return balances.filter((b) => {
    const usd = parseUsd(b.usd_value ?? '0');
    if (opts.hideSmall && usd < HIDE_SMALL_USD_THRESHOLD && usd > -HIDE_SMALL_USD_THRESHOLD) return false;
    if (!q) return true;
    return (
      b.symbol.toLowerCase().includes(q) ||
      (b.name ?? '').toLowerCase().includes(q)
    );
  });
}

export function filterFundingBalances(
  balances: AssetBalance[],
  opts: { search: string; hideSmall: boolean },
): AssetBalance[] {
  const q = opts.search.trim().toLowerCase();
  return balances.filter((b) => {
    if (opts.hideSmall && parseUsd(b.usd_value) < HIDE_SMALL_USD_THRESHOLD) return false;
    if (!q) return true;
    return (
      b.symbol.toLowerCase().includes(q) ||
      b.name.toLowerCase().includes(q)
    );
  });
}

export function sortFundingBalances(
  balances: AssetBalance[],
  sortKey: FundingSortKey,
  sortDir: SortDirection,
): AssetBalance[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...balances].sort((a, b) => {
    switch (sortKey) {
      case 'symbol':
        return a.symbol.localeCompare(b.symbol) * dir;
      case 'balance':
        return (parseFloat(a.total_balance) - parseFloat(b.total_balance)) * dir;
      case 'value':
        return (parseUsd(a.usd_value) - parseUsd(b.usd_value)) * dir;
      default:
        return 0;
    }
  });
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function formatCryptoAmount(value: string | number, decimals = 8): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return `0.${'0'.repeat(Math.min(decimals, 8))}`;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(decimals, 8),
    maximumFractionDigits: Math.min(decimals, 8),
  });
}

export function validateTransferAmount(amount: string, available: string): string | null {
  const a = parseFloat(amount);
  const avail = parseFloat(available);
  if (!Number.isFinite(a) || a <= 0) return 'Enter a valid amount';
  if (!Number.isFinite(avail) || a > avail) return 'Insufficient balance';
  return null;
}
