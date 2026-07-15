import { describe, it, expect } from '@jest/globals';
import {
  formatQuoteCountdown,
  buildQuoteSnapshot,
  computeSlippagePercent,
  validateConvertPair,
  validateConvertAmount,
  mapConvertApiError,
  formatRateDisplay,
} from '@core/domain/wallet/convert';

describe('convert domain', () => {
  it('formats countdown', () => {
    expect(formatQuoteCountdown(65000)).toBe('1:05');
  });

  it('builds quote snapshot', () => {
    const snap = buildQuoteSnapshot({
      from: { symbol: 'BTC', amount: '1', id: 'a' },
      to: { symbol: 'USDT', amount: '50000', id: 'b' },
      rate: '50000',
      fee: '0',
      expiresIn: 30,
    });
    expect(snap?.toAmount).toBe('50000');
  });

  it('computes slippage', () => {
    expect(computeSlippagePercent('1', '100', '98')).toContain('2.00');
  });

  it('validates pair', () => {
    expect(validateConvertPair('BTC', 'BTC')).toBeTruthy();
  });

  it('validates amount', () => {
    expect(validateConvertAmount('2', '1')).toBeTruthy();
  });

  it('maps api error', () => {
    expect(mapConvertApiError('INSUFFICIENT_BALANCE', '')).toContain('Insufficient');
  });

  it('formats rate display', () => {
    expect(formatRateDisplay('BTC', 'USDT', '50000')).toContain('BTC');
  });
});
