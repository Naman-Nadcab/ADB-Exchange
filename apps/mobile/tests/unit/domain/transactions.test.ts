import { describe, it, expect } from '@jest/globals';
import { normalizeWalletTx, formatTxAmount } from '@core/domain/wallet/transactions';
import { computePeriodPnl, maskBalance } from '@core/domain/wallet/portfolio';

describe('wallet transactions domain', () => {
  it('normalizes backend withdraw row', () => {
    const tx = normalizeWalletTx({
      id: '1',
      type: 'withdraw',
      coin: 'BTC',
      quantity: '0.5',
      status: 'completed',
      date_time: '2026-07-01T12:00:00Z',
    });
    expect(tx.type).toBe('withdrawal');
    expect(tx.symbol).toBe('BTC');
    expect(tx.amount).toBe('0.5');
  });

  it('normalizes deposit row', () => {
    const tx = normalizeWalletTx({
      id: '2',
      type: 'deposit',
      coin: 'ETH',
      quantity: 1.25,
      status: 'confirmed',
      created_at: '2026-07-02T08:00:00Z',
    });
    expect(tx.type).toBe('deposit');
    expect(tx.amount).toBe('1.25');
  });

  it('formats small tx amounts', () => {
    expect(formatTxAmount('0.001')).toBe('0.001000');
  });
});

describe('portfolio period pnl', () => {
  it('computes period pnl from history', () => {
    const pnl = computePeriodPnl([
      { total_usd: 100 },
      { total_usd: 110 },
    ]);
    expect(pnl?.amount).toBe(10);
    expect(pnl?.percent).toBeCloseTo(10);
  });

  it('masks balances when hidden', () => {
    expect(maskBalance('1,234.50', false)).toBe('••••••');
    expect(maskBalance('1,234.50', true)).toBe('1,234.50');
  });
});
