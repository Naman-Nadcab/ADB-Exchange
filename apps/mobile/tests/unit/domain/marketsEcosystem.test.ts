import { describe, it, expect } from '@jest/globals';
import { relatedPairs, marketPulse, popularMarkets } from '@core/domain/markets/marketUtils';
import { filterBySector } from '@core/domain/markets/sectors';
import type { MarketListItem } from '@exchange/mobile-types';

const sample: MarketListItem[] = [
  { symbol: 'BTC_USDT', baseAsset: 'BTC', quoteAsset: 'USDT', lastPrice: 60000, changePct: 2, volume24h: 1e9, high24h: 61000, low24h: 59000, marketCap: 1e12 },
  { symbol: 'ETH_USDT', baseAsset: 'ETH', quoteAsset: 'USDT', lastPrice: 3000, changePct: -1, volume24h: 5e8, high24h: 3100, low24h: 2900, marketCap: 4e11 },
  { symbol: 'ETH_BTC', baseAsset: 'ETH', quoteAsset: 'BTC', lastPrice: 0.05, changePct: 0.5, volume24h: 1e7, high24h: 0.051, low24h: 0.049 },
  { symbol: 'SOL_USDT', baseAsset: 'SOL', quoteAsset: 'USDT', lastPrice: 150, changePct: 5, volume24h: 2e8, high24h: 155, low24h: 140 },
];

describe('markets ecosystem utils', () => {
  it('computes market pulse', () => {
    const pulse = marketPulse(sample);
    expect(pulse.bullishPct + pulse.bearishPct).toBe(100);
  });

  it('finds related pairs by quote and base', () => {
    const related = relatedPairs(sample, 'BTC_USDT', 4);
    expect(related.some((r) => r.symbol === 'ETH_USDT')).toBe(true);
    expect(related.every((r) => r.symbol !== 'BTC_USDT')).toBe(true);
  });

  it('filters sector Layer1', () => {
    const layer1 = filterBySector(sample, 'Layer1');
    expect(layer1.map((i) => i.baseAsset)).toContain('BTC');
    expect(layer1.map((i) => i.baseAsset)).toContain('ETH');
  });

  it('popular markets sorts by volume', () => {
    const pop = popularMarkets(sample, 2);
    expect(pop[0].symbol).toBe('BTC_USDT');
  });
});
