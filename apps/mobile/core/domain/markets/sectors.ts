import type { MarketListItem } from '@exchange/mobile-types';

export type MarketSector = 'AI' | 'Meme' | 'Layer1' | 'Layer2' | 'Gaming' | 'RWA' | 'DePIN';

export const SECTOR_MAP: Record<MarketSector, string[]> = {
  AI: ['FET', 'RENDER', 'WLD', 'GRT', 'INJ'],
  Meme: ['DOGE', 'SHIB', 'PEPE', 'BONK', 'FLOKI', 'WIF'],
  Layer1: ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'ATOM', 'SUI', 'SEI'],
  Layer2: ['ARB', 'OP', 'MATIC', 'IMX'],
  Gaming: ['IMX', 'AXS', 'SAND', 'MANA'],
  RWA: ['ONDO', 'MKR', 'LINK'],
  DePIN: ['FIL', 'AR', 'RENDER', 'THETA'],
};

export const SECTOR_LABELS: Record<MarketSector, string> = {
  AI: 'AI',
  Meme: 'Meme',
  Layer1: 'Layer 1',
  Layer2: 'Layer 2',
  Gaming: 'Gaming',
  RWA: 'RWA',
  DePIN: 'DePIN',
};

export function filterBySector(items: MarketListItem[], sector: MarketSector | null): MarketListItem[] {
  if (!sector) return items;
  const assets = new Set(SECTOR_MAP[sector]);
  return items.filter((i) => assets.has(i.baseAsset));
}

export function sectorPerformance(items: MarketListItem[], sector: MarketSector) {
  const sectorItems = filterBySector(items, sector);
  if (!sectorItems.length) return { avgChange: 0, leaders: [] as MarketListItem[] };
  const avgChange = sectorItems.reduce((s, i) => s + i.changePct, 0) / sectorItems.length;
  const leaders = [...sectorItems].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  return { avgChange, leaders };
}
