import type { AssetBalance, TradingBalance } from '@exchange/mobile-types';

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
  hideZero: boolean;
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
  if (filters.hideZero) {
    out = out.filter((a) => parseUsd(a.usdValue) > 0.01 || parseFloat(a.totalBalance) > 0);
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

export function validateTransferAmount(amount: string, available: string): string | null {
  const a = parseFloat(amount);
  const avail = parseFloat(available);
  if (!Number.isFinite(a) || a <= 0) return 'Enter a valid amount';
  if (!Number.isFinite(avail) || a > avail) return 'Insufficient balance';
  return null;
}
