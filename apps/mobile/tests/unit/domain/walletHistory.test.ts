import { describe, it, expect } from '@jest/globals';
import {
  applyWalletHistoryFilters,
  mapFromWalletRecentTransaction,
  matchesWalletHistorySearch,
  inferOnChainMethod,
  buildWalletHistoryTimeline,
} from '@core/domain/wallet/walletHistory';

describe('walletHistory domain', () => {
  it('maps transactions/all row with tx metadata', () => {
    const row = mapFromWalletRecentTransaction({
      id: '1',
      type: 'deposit',
      symbol: 'BTC',
      amount: '0.1',
      status: 'pending',
      created_at: '2026-07-01T12:00:00Z',
      chain_type: 'Bitcoin',
      txid: 'abc123',
      confirmations: 2,
      requiredConfirmations: 6,
    });
    expect(row.detail?.screen).toBe('DepositDetail');
    expect(row.method).toBe('on-chain');
  });

  it('filters by search and status', () => {
    const rows = [
      mapFromWalletRecentTransaction({
        id: '1',
        type: 'withdrawal',
        symbol: 'ETH',
        amount: '1',
        status: 'completed',
        created_at: '2026-07-02T08:00:00Z',
        txid: '0xdead',
      }),
    ];
    expect(matchesWalletHistorySearch(rows[0]!, '0xdead')).toBe(true);
    const filtered = applyWalletHistoryFilters(rows, {
      asset: '',
      status: 'completed',
      method: 'all',
      startDate: '',
      endDate: '',
      search: 'eth',
    });
    expect(filtered).toHaveLength(1);
  });

  it('detects internal withdrawal method', () => {
    expect(
      inferOnChainMethod({
        kind: 'withdraw',
        chainType: 'Sent to user@example.com',
        address: 'user@example.com',
      }),
    ).toBe('internal');
  });

  it('builds timeline steps for pending status', () => {
    const steps = buildWalletHistoryTimeline('pending', 'deposit');
    expect(steps).toHaveLength(3);
    expect(steps[1]?.state).toBe('active');
  });
});
