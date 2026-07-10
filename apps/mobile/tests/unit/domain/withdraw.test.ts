import { describe, it, expect } from '@jest/globals';
import {
  validateCryptoAddress,
  validateMemo,
  validateWithdrawAmount,
  formatNetworkLabel,
} from '@core/domain/wallet/withdraw';

describe('withdraw domain', () => {
  it('validates address', () => {
    expect(validateCryptoAddress('')).toBeTruthy();
    expect(validateCryptoAddress('0x1234567890abcdef')).toBeNull();
  });

  it('validates memo', () => {
    expect(validateMemo('', false)).toBeNull();
    expect(validateMemo('', true)).toBeTruthy();
  });

  it('validates withdraw amount against backend min', () => {
    expect(validateWithdrawAmount('0.5', '1', '0.1')).toBeNull();
    expect(validateWithdrawAmount('0.05', '1', '0.1')).toBeTruthy();
    expect(validateWithdrawAmount('2', '1', '0')).toBeTruthy();
  });

  it('formats network label', () => {
    expect(formatNetworkLabel('Ethereum', 12)).toContain('12 confirmations');
  });
});
