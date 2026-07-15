import { describe, it, expect } from '@jest/globals';
import {
  needsMemoTag,
  estimateArrivalTime,
  buildDepositExplorerUrl,
  depositStatusLabel,
  pickRecommendedChain,
} from '@core/domain/wallet/deposit';

describe('deposit domain', () => {
  it('detects memo-required coins', () => {
    expect(needsMemoTag('XRP')).toBe(true);
    expect(needsMemoTag('btc')).toBe(false);
  });

  it('estimates arrival time', () => {
    expect(estimateArrivalTime(12, 'evm')).toBe('~3 min');
  });

  it('builds explorer url', () => {
    expect(buildDepositExplorerUrl('abc123', 'ETH')).toContain('abc123');
  });

  it('formats pending status with confirmations', () => {
    expect(depositStatusLabel('pending', 3, 12)).toBe('3/12 confirmations');
  });

  it('picks first active chain as recommended', () => {
    const chain = pickRecommendedChain([
      { id: '1', name: 'Off', type: 'evm', is_active: false },
      { id: '2', name: 'ETH', type: 'evm', is_active: true },
    ]);
    expect(chain?.id).toBe('2');
  });
});
