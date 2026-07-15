import { QueryClient } from '@tanstack/react-query';
import type { FiatWithdrawal } from '@exchange/mobile-types';
import {
  FIAT_WITHDRAWALS_QUERY_KEY,
  bankLabelFromPaymentMethod,
  bankLabelFromSnapshot,
  canCancelFiatWithdrawal,
  formatInr,
  mapFiatWithdrawApiError,
  resolveFiatWithdrawal,
} from '@core/domain/wallet/fiat';

describe('fiat domain', () => {
  it('formats INR amounts', () => {
    expect(formatInr('1234.5')).toContain('₹');
    expect(formatInr('1234.5')).toContain('1,234.50');
    expect(formatInr('bad')).toBe('₹0.00');
  });

  it('labels payment methods and snapshots', () => {
    expect(bankLabelFromPaymentMethod({ display_name: '  My Bank ', method_name: 'UPI' })).toBe('My Bank');
    expect(bankLabelFromPaymentMethod({ method_name: 'IMPS' })).toBe('IMPS');
    expect(bankLabelFromSnapshot({ display_name: 'HDFC', method_name: 'Bank' })).toBe('HDFC');
    expect(bankLabelFromSnapshot({ method_name: 'UPI' })).toBe('UPI');
    expect(bankLabelFromSnapshot(null)).toBe('Bank account');
  });

  it('detects cancellable status', () => {
    expect(canCancelFiatWithdrawal('pending')).toBe(true);
    expect(canCancelFiatWithdrawal('completed')).toBe(false);
  });

  it('maps API errors', () => {
    expect(mapFiatWithdrawApiError('WITHDRAWALS_PAUSED', '')).toContain('paused');
    expect(mapFiatWithdrawApiError('INSUFFICIENT_BALANCE', '')).toContain('Insufficient');
  });

  it('resolves withdrawal via seed then cache (ADR-011)', () => {
    const qc = new QueryClient();
    const seed: FiatWithdrawal = {
      id: 'w1',
      currency: 'INR',
      amount: '100',
      fee: '0',
      net_amount: '100',
      bank_account_id: 'b1',
      bank_snapshot: {},
      status: 'pending',
      provider: 'manual',
      provider_reference: null,
      admin_notes: null,
      failure_reason: null,
      requested_at: '2026-01-01T00:00:00Z',
      reviewed_at: null,
      completed_at: null,
    };
    expect(resolveFiatWithdrawal(qc, 'w1', seed)?.id).toBe('w1');
    qc.setQueryData(FIAT_WITHDRAWALS_QUERY_KEY, [seed]);
    expect(resolveFiatWithdrawal(qc, 'w1')?.id).toBe('w1');
    expect(resolveFiatWithdrawal(qc, 'missing')).toBeNull();
  });
});
