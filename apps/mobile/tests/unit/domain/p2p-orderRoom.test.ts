import type { P2POrder } from '@exchange/mobile-types';
import {
  buildOrderStatusTimeline,
  getOrderRoomPermissions,
  isTerminalOrderStatus,
  orderStatusLabel,
  paymentVerificationGate,
  resolveOrderRole,
  validateCancelReason,
  validateDisputeReason,
  validateTransactionReference,
} from '@core/domain/p2p/orderRoom';

const baseOrder = (): P2POrder => ({
  id: 'ord-1',
  ad_id: 'ad-1',
  buyer_id: 'buyer-1',
  seller_id: 'seller-1',
  status: 'payment_pending',
  quantity: '100',
  fiat_amount: '9200',
  fiat_currency: 'INR',
  crypto_symbol: 'USDT',
  buyer_username: 'alice',
  seller_username: 'bob',
});

describe('p2p orderRoom domain', () => {
  it('labels statuses like website', () => {
    expect(orderStatusLabel('payment_pending')).toBe('Awaiting Payment');
    expect(orderStatusLabel('payment_confirmed')).toBe('Paid — Awaiting Release');
    expect(orderStatusLabel('completed')).toBe('Completed');
  });

  it('detects terminal statuses', () => {
    expect(isTerminalOrderStatus('completed')).toBe(true);
    expect(isTerminalOrderStatus('payment_pending')).toBe(false);
  });

  it('resolves buyer/seller role', () => {
    const o = baseOrder();
    expect(resolveOrderRole(o, 'buyer-1')).toBe('buyer');
    expect(resolveOrderRole(o, 'seller-1')).toBe('seller');
    expect(resolveOrderRole(o, 'other')).toBe('none');
  });

  it('gates release on payment verification', () => {
    expect(paymentVerificationGate({ ...baseOrder(), payment_verification_status: null })).toBe(true);
    expect(paymentVerificationGate({ ...baseOrder(), payment_verification_status: 'verified' })).toBe(true);
    expect(paymentVerificationGate({ ...baseOrder(), payment_verification_status: 'pending' })).toBe(false);
  });

  it('computes action permissions from website rules', () => {
    const pending = baseOrder();
    expect(getOrderRoomPermissions(pending, 'buyer').canPay).toBe(true);
    expect(getOrderRoomPermissions(pending, 'buyer').canCancel).toBe(true);
    expect(getOrderRoomPermissions(pending, 'seller').canPay).toBe(false);

    const confirmed = { ...baseOrder(), status: 'payment_confirmed', payment_verification_status: 'pending' as const };
    expect(getOrderRoomPermissions(confirmed, 'seller').canVerify).toBe(true);
    expect(getOrderRoomPermissions(confirmed, 'seller').canRelease).toBe(false);
    expect(getOrderRoomPermissions(confirmed, 'buyer').canDispute).toBe(true);

    const verified = { ...confirmed, payment_verification_status: 'verified' as const };
    expect(getOrderRoomPermissions(verified, 'seller').canRelease).toBe(true);

    const disputed = { ...baseOrder(), status: 'disputed' as const };
    expect(getOrderRoomPermissions(disputed, 'buyer').chatEnabled).toBe(true);
  });

  it('builds website 4-step timeline', () => {
    const steps = buildOrderStatusTimeline('payment_pending');
    expect(steps.find((s) => s.label === 'Payment')?.active).toBe(true);
    const done = buildOrderStatusTimeline('completed');
    expect(done.every((s) => s.done)).toBe(true);
  });

  it('validates dispute and payment inputs', () => {
    expect(validateDisputeReason('short')).toMatch(/10/);
    expect(validateDisputeReason('a'.repeat(11))).toBeNull();
    expect(validateTransactionReference('')).toMatch(/reference/);
    expect(validateCancelReason('')).toMatch(/required/);
  });
});
