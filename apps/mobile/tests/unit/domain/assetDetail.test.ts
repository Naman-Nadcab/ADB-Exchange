import { describe, it, expect } from '@jest/globals';
import { computeAssetHoldings, formatMarketCap } from '@core/domain/wallet/assetDetail';

describe('assetDetail domain', () => {
  it('computes combined funding and spot holdings', () => {
    const h = computeAssetHoldings(
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        total_balance: '1.5',
        available_balance: '1',
        locked_balance: '0.5',
        usd_value: '75000',
      },
      {
        asset: 'BTC',
        balance: '0.5',
        available_balance: '0.3',
        locked_balance: '0.2',
        account_type: 'spot',
      },
    );
    expect(h.grandTotal).toBe(2);
    expect(h.totalAvailable).toBe(1.3);
    expect(h.inOrders).toBe(0.7);
    expect(h.tradingLocked).toBe(0.2);
  });

  it('formats market cap tiers', () => {
    expect(formatMarketCap(1.5e12)).toBe('$1.50T');
    expect(formatMarketCap(null)).toBe('—');
  });
});
