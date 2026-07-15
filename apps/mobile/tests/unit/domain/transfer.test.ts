import { describe, it, expect } from '@jest/globals';
import {
  validateSameAccount,
  applyTransferPercent,
  computeRemainingBalance,
  filterTransferTokens,
  mapTransferApiError,
  transferAccountLabel,
} from '@core/domain/wallet/transfer';

describe('transfer domain', () => {
  it('rejects same account', () => {
    expect(validateSameAccount('funding', 'funding')).toBeTruthy();
    expect(validateSameAccount('funding', 'trading')).toBeNull();
  });

  it('applies percent to available', () => {
    expect(parseFloat(applyTransferPercent('10', 50))).toBe(5);
  });

  it('computes remaining balance', () => {
    expect(computeRemainingBalance('10', '3')).toBe('7');
  });

  it('filters zero balances', () => {
    const tokens = [
      { tokenId: '1', symbol: 'BTC', name: 'Bitcoin', decimals: 8, availableBalance: '0' },
      { tokenId: '2', symbol: 'ETH', name: 'Ethereum', decimals: 8, availableBalance: '1' },
    ];
    expect(filterTransferTokens(tokens, { hideZero: true }).length).toBe(1);
  });

  it('maps same account error', () => {
    expect(mapTransferApiError('SAME_ACCOUNT', '')).toContain('same account');
  });

  it('labels funding account', () => {
    expect(transferAccountLabel('funding')).toContain('Funding');
  });
});
