import { describe, it, expect } from '@jest/globals';
import {
  mergeAssets,
  computeAllocation,
  filterAssets,
  validateTransferAmount,
  formatUsd,
} from '@core/domain/wallet/portfolio';

describe('portfolio domain', () => {
  it('merges funding and trading balances', () => {
    const merged = mergeAssets(
      [{ symbol: 'BTC', name: 'Bitcoin', total_balance: '1', available_balance: '1', locked_balance: '0', usd_value: '50000' }],
      [{ symbol: 'BTC', equity: '0.5', name: 'Bitcoin' }],
    );
    expect(merged[0].totalBalance).toBe('1.5');
  });

  it('computes allocation', () => {
    const slices = computeAllocation([
      { symbol: 'BTC', name: 'Bitcoin', fundingTotal: '1', fundingAvailable: '1', fundingLocked: '0', tradingEquity: '0', usdValue: '75', totalBalance: '1' },
      { symbol: 'ETH', name: 'Ethereum', fundingTotal: '1', fundingAvailable: '1', fundingLocked: '0', tradingEquity: '0', usdValue: '25', totalBalance: '1' },
    ]);
    expect(slices[0].symbol).toBe('BTC');
    expect(slices[0].pct).toBeCloseTo(75);
  });

  it('filters zero balances', () => {
    const out = filterAssets(
      [
        { symbol: 'BTC', name: 'Bitcoin', fundingTotal: '0', fundingAvailable: '0', fundingLocked: '0', tradingEquity: '0', usdValue: '0', totalBalance: '0' },
        { symbol: 'ETH', name: 'Ethereum', fundingTotal: '1', fundingAvailable: '1', fundingLocked: '0', tradingEquity: '0', usdValue: '10', totalBalance: '1' },
      ],
      { search: '', hideZero: true, hidden: new Set(), favorites: new Set(), sort: 'value' },
    );
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe('ETH');
  });

  it('validates transfer amount', () => {
    expect(validateTransferAmount('0', '10')).toBeTruthy();
    expect(validateTransferAmount('5', '10')).toBeNull();
    expect(validateTransferAmount('15', '10')).toBeTruthy();
  });

  it('formats usd', () => {
    expect(formatUsd(1234.5)).toBe('1,234.50');
  });
});
