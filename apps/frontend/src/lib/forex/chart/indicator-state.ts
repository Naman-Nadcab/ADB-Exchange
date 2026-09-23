import type { StoredForexIndicator } from './indicator-registry';

export function forexIndicatorStorageKey(symbol: string, timeframe: string): string {
  return `eda-forex-chart-indicators:${symbol.replace(/[^A-Za-z0-9]/g, '')}:${timeframe}`;
}

export function loadScopedForexIndicators(symbol: string, timeframe: string): StoredForexIndicator[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(forexIndicatorStorageKey(symbol, timeframe));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredForexIndicator[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScopedForexIndicators(symbol: string, timeframe: string, rows: StoredForexIndicator[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(forexIndicatorStorageKey(symbol, timeframe), JSON.stringify(rows));
}
