import type { PnlAsset } from '@exchange/mobile-types';

export type PnlPeriod = 'today' | '7d' | '30d' | '90d';

export const PNL_PERIODS: { id: PnlPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

export type PnlSortKey = 'pnl' | 'pnlPercent' | 'quantity';
export type PnlSortDir = 'asc' | 'desc';

export function pnlSign(value: number): string {
  return value > 0 ? '+' : '';
}

export function formatPnlCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildCumulativePnlPoints(assets: PnlAsset[]): number[] {
  let cumulative = 0;
  return assets.map((asset) => {
    cumulative += asset.pnl;
    return cumulative;
  });
}

export function maxAbsPnl(assets: PnlAsset[]): number {
  return Math.max(1, ...assets.map((a) => Math.abs(a.pnl)));
}

export function getBestPerformer(assets: PnlAsset[]): PnlAsset | null {
  if (assets.length === 0) return null;
  return [...assets].sort((a, b) => b.pnl - a.pnl)[0] ?? null;
}

export function getWorstPerformer(assets: PnlAsset[]): PnlAsset | null {
  if (assets.length === 0) return null;
  return [...assets].sort((a, b) => a.pnl - b.pnl)[0] ?? null;
}

export function sortPnlAssets(
  assets: PnlAsset[],
  sortKey: PnlSortKey,
  sortDir: PnlSortDir,
): PnlAsset[] {
  const copy = [...assets];
  copy.sort((a, b) => {
    let diff = 0;
    if (sortKey === 'pnl') diff = a.pnl - b.pnl;
    else if (sortKey === 'pnlPercent') diff = a.pnlPercent - b.pnlPercent;
    else diff = a.quantity - b.quantity;
    return sortDir === 'desc' ? -diff : diff;
  });
  return copy;
}

export function extractSymbolOptions(assets: PnlAsset[]): string[] {
  return Array.from(new Set(assets.map((a) => a.symbol))).sort();
}

export function filterSymbolsBySearch(symbols: string[], query: string): string[] {
  const q = query.trim().toUpperCase();
  if (!q) return symbols;
  return symbols.filter((s) => s.toUpperCase().includes(q));
}

export function hasNoPnlData(
  loading: boolean,
  assets: PnlAsset[],
  totalPnl: number,
): boolean {
  return !loading && assets.length === 0 && totalPnl === 0;
}
