import { describe, it, expect } from '@jest/globals';
import {
  buildCumulativePnlPoints,
  filterSymbolsBySearch,
  formatPnlCompact,
  getBestPerformer,
  getWorstPerformer,
  hasNoPnlData,
  maxAbsPnl,
  pnlSign,
  sortPnlAssets,
} from '@core/domain/wallet/pnl';
import type { PnlAsset } from '@exchange/mobile-types';

const sample: PnlAsset[] = [
  { symbol: 'BTC', pnl: 100, pnlPercent: 10, avgBuyPrice: 50000, currentPrice: 0, quantity: 0.1 },
  { symbol: 'ETH', pnl: -50, pnlPercent: -5, avgBuyPrice: 3000, currentPrice: 0, quantity: 2 },
  { symbol: 'SOL', pnl: 25, pnlPercent: 2.5, avgBuyPrice: 100, currentPrice: 0, quantity: 10 },
];

describe('wallet pnl domain', () => {
  it('formats compact values', () => {
    expect(formatPnlCompact(1500)).toBe('1.50K');
    expect(formatPnlCompact(-2_500_000)).toBe('-2.50M');
  });

  it('builds cumulative pnl points', () => {
    expect(buildCumulativePnlPoints(sample)).toEqual([100, 50, 75]);
  });

  it('sorts assets by pnl descending', () => {
    const sorted = sortPnlAssets(sample, 'pnl', 'desc');
    expect(sorted.map((a) => a.symbol)).toEqual(['BTC', 'SOL', 'ETH']);
  });

  it('finds best and worst performers', () => {
    expect(getBestPerformer(sample)?.symbol).toBe('BTC');
    expect(getWorstPerformer(sample)?.symbol).toBe('ETH');
  });

  it('computes max abs pnl with floor of 1', () => {
    expect(maxAbsPnl([{ ...sample[0], pnl: 0 }])).toBe(1);
    expect(maxAbsPnl(sample)).toBe(100);
  });

  it('detects empty pnl state', () => {
    expect(hasNoPnlData(false, [], 0)).toBe(true);
    expect(hasNoPnlData(true, [], 0)).toBe(false);
    expect(hasNoPnlData(false, sample, 75)).toBe(false);
  });

  it('filters symbols by search', () => {
    expect(filterSymbolsBySearch(['BTC', 'ETH'], 'bt')).toEqual(['BTC']);
  });

  it('adds plus sign for positive pnl', () => {
    expect(pnlSign(1)).toBe('+');
    expect(pnlSign(-1)).toBe('');
  });
});
