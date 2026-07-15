import { QueryClient } from '@tanstack/react-query';
import type { P2PUserPaymentMethod } from '@exchange/mobile-types';
import {
  buildPaymentDetailsPayload,
  countPaymentMethodsByActive,
  findPaymentMethodInCache,
  getFieldsForMethodCode,
  isPaymentMethodActive,
  P2P_MY_PAYMENT_METHODS_LIST_KEY,
  validatePaymentMethodForm,
  verificationBadge,
} from '@core/domain/p2p/paymentMethods';

const method = (over: Partial<P2PUserPaymentMethod> = {}): P2PUserPaymentMethod => ({
  id: 'pm-1',
  payment_method_id: 'plat-1',
  method_name: 'UPI',
  method_code: 'upi',
  display_name: 'My UPI',
  is_active: true,
  is_verified: true,
  payment_details: { account_name: 'Alice', upi_id: 'alice@upi' },
  ...over,
});

describe('p2p paymentMethods domain', () => {
  it('returns UPI fields for upi code', () => {
    const fields = getFieldsForMethodCode('upi');
    expect(fields.some((f) => f.key === 'upi_id')).toBe(true);
  });

  it('validates required fields', () => {
    const defs = getFieldsForMethodCode('upi');
    expect(validatePaymentMethodForm('', {}, defs)).toMatch(/Select/);
    expect(validatePaymentMethodForm('plat-1', { account_name: 'A' }, defs)).toMatch(/UPI ID/);
    expect(validatePaymentMethodForm('plat-1', { account_name: 'A', upi_id: 'a@upi' }, defs)).toBeNull();
  });

  it('builds payment details payload', () => {
    const defs = getFieldsForMethodCode('upi');
    expect(buildPaymentDetailsPayload({ account_name: 'A', upi_id: 'a@upi', bank_name: '' }, defs)).toEqual({
      account_name: 'A',
      upi_id: 'a@upi',
    });
  });

  it('counts active vs disabled', () => {
    expect(
      countPaymentMethodsByActive([method(), method({ id: 'pm-2', is_active: false })]),
    ).toEqual({ active: 1, disabled: 1 });
  });

  it('detects active state from backend flag', () => {
    expect(isPaymentMethodActive(method())).toBe(true);
    expect(isPaymentMethodActive(method({ is_active: false }))).toBe(false);
  });

  it('maps verification badge from is_verified', () => {
    expect(verificationBadge(method())?.label).toBe('Verified');
    expect(verificationBadge(method({ is_verified: false }))?.label).toBe('Pending verification');
  });
});

describe('p2p paymentMethods ADR-011 cache', () => {
  it('finds payment method in list cache', () => {
    const qc = new QueryClient();
    qc.setQueryData(P2P_MY_PAYMENT_METHODS_LIST_KEY, [method()]);
    expect(findPaymentMethodInCache(qc, 'pm-1')?.method_name).toBe('UPI');
  });
});
