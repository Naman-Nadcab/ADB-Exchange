import { describe, it, expect } from '@jest/globals';
import {
  mergeAssets,
  computeAllocation,
  filterAssets,
  validateTransferAmount,
  formatUsd,
  topFundingHoldings,
  filterFundingBalances,
  sortFundingBalances,
  filterTradingBalances,
  paginateItems,
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

  it('filters small balances when hideSmall is enabled', () => {
    const out = filterAssets(
      [
        { symbol: 'BTC', name: 'Bitcoin', fundingTotal: '0.001', fundingAvailable: '0.001', fundingLocked: '0', tradingEquity: '0', usdValue: '0.50', totalBalance: '0.001' },
        { symbol: 'ETH', name: 'Ethereum', fundingTotal: '1', fundingAvailable: '1', fundingLocked: '0', tradingEquity: '0', usdValue: '10', totalBalance: '1' },
      ],
      { search: '', hideSmall: true, hidden: new Set(), favorites: new Set(), sort: 'value' },
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.symbol).toBe('ETH');
  });

  it('computes top funding holdings', () => {
    const top = topFundingHoldings([
      { symbol: 'BTC', name: 'Bitcoin', total_balance: '1', available_balance: '1', locked_balance: '0', usd_value: '50000' },
      { symbol: 'ETH', name: 'Ethereum', total_balance: '2', available_balance: '2', locked_balance: '0', usd_value: '6000' },
    ]);
    expect(top[0]?.symbol).toBe('BTC');
    expect(top).toHaveLength(2);
  });

  it('filters trading balances with website unified hide-small rule', () => {
    const rows = [
      { symbol: 'BTC', equity: '1', wallet_balance: '1', usd_value: '50000', name: 'Bitcoin' },
      { symbol: 'DOGE', equity: '100', wallet_balance: '100', usd_value: '0.50', name: 'Dogecoin' },
      { symbol: 'ETH', equity: '2', wallet_balance: '2', usd_value: '6000', name: 'Ethereum' },
    ];
    const filtered = filterTradingBalances(rows, { search: 'bit', hideSmall: false });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.symbol).toBe('BTC');
    const hidden = filterTradingBalances(rows, { search: '', hideSmall: true });
    expect(hidden).toHaveLength(2);
  });

  it('filters and sorts funding balances', () => {
    const rows = [
      { symbol: 'BTC', name: 'Bitcoin', total_balance: '1', available_balance: '1', locked_balance: '0', usd_value: '50000' },
      { symbol: 'DOGE', name: 'Dogecoin', total_balance: '100', available_balance: '100', locked_balance: '0', usd_value: '0.50' },
      { symbol: 'ETH', name: 'Ethereum', total_balance: '2', available_balance: '2', locked_balance: '0', usd_value: '6000' },
    ];
    const filtered = filterFundingBalances(rows, { search: '', hideSmall: true });
    expect(filtered).toHaveLength(2);
    const sorted = sortFundingBalances(filtered, 'symbol', 'asc');
    expect(sorted[0]?.symbol).toBe('BTC');
    expect(paginateItems(sorted, 1, 1)).toHaveLength(1);
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
