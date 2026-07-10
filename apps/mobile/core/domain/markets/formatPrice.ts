import type { MarketListItem } from '@exchange/mobile-types';

/** Price formatting with localization-ready structure. */
export function formatPrice(value: number, quoteAsset = 'USDT'): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  const abs = Math.abs(value);
  let decimals = 2;
  if (abs < 0.01) decimals = 6;
  else if (abs < 1) decimals = 4;
  else if (abs >= 1000) decimals = 2;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  });
  return `${formatted} ${quoteAsset}`;
}

export function formatChangePct(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toFixed(2);
}

export function changeColorKey(change: number): 'buy' | 'sell' | 'muted' {
  if (change > 0) return 'buy';
  if (change < 0) return 'sell';
  return 'muted';
}

export function applyLiveTicker(item: MarketListItem, live: Partial<MarketListItem>): MarketListItem {
  return {
    ...item,
    lastPrice: live.lastPrice ?? item.lastPrice,
    changePct: live.changePct ?? item.changePct,
    volume24h: live.volume24h ?? item.volume24h,
    high24h: live.high24h ?? item.high24h,
    low24h: live.low24h ?? item.low24h,
  };
}
