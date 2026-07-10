import { describe, it, expect } from '@jest/globals';
import {
  mergeTickers,
  searchMarkets,
  filterByTab,
  topGainers,
  normalizeSymbol,
} from '@core/domain/markets/marketUtils';
import type { SpotTicker } from '@exchange/mobile-types';

const sample: SpotTicker[] = [
  {
    symbol: 'BTC_USDT',
    base_asset: 'BTC',
    quote_asset: 'USDT',
    last_price: '50000',
    open_24h: '49000',
    high_24h: '51000',
    low_24h: '48000',
    volume_24h: '1000000',
    change_pct: 2.5,
  },
  {
    symbol: 'ETH_USDT',
    base_asset: 'ETH',
    quote_asset: 'USDT',
    last_price: '3000',
    open_24h: '3100',
    high_24h: '3200',
    low_24h: '2900',
    volume_24h: '500000',
    change_pct: -3.2,
  },
];

describe('marketUtils', () => {
  it('merges tickers to list items', () => {
    const items = mergeTickers(sample);
    expect(items[0].symbol).toBe('BTC_USDT');
    expect(items[0].changePct).toBe(2.5);
  });

  it('searches by base asset', () => {
    const items = mergeTickers(sample);
    expect(searchMarkets(items, 'eth')).toHaveLength(1);
  });

  it('filters gainers', () => {
    const items = mergeTickers(sample);
    const gainers = filterByTab(items, 'gainers', []);
    expect(gainers.every((g) => g.changePct > 0)).toBe(true);
  });

  it('normalizes symbols', () => {
    expect(normalizeSymbol('btc-usdt')).toBe('BTC_USDT');
  });

  it('top gainers sorted', () => {
    const items = mergeTickers(sample);
    expect(topGainers(items, 1)[0].baseAsset).toBe('BTC');
  });
});
