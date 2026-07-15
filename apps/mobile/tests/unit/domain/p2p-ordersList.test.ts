import type { P2POrder } from '@exchange/mobile-types';
import {
  computeOrderListStats,
  counterpartyLabel,
  formatOrderTimeLeft,
  hasPaymentProof,
  orderSide,
  ordersNeedLiveRefresh,
  pairLabel,
  payMethodLabel,
  sortOrdersByCreatedDesc,
  unitPriceDisplay,
} from '@core/domain/p2p/ordersList';

const baseOrder = (overrides: Partial<P2POrder> = {}): P2POrder => ({
  id: 'ord-abc123456789',
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
  seller_payment_method_name: 'UPI',
  ...overrides,
});

describe('p2p ordersList domain', () => {
  it('sorts by created_at desc', () => {
    const a = baseOrder({ id: 'a', created_at: '2026-01-01T00:00:00Z' });
    const b = baseOrder({ id: 'b', created_at: '2026-02-01T00:00:00Z' });
    expect(sortOrdersByCreatedDesc([a, b]).map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('computes list stats', () => {
    const orders = [
      baseOrder({ status: 'payment_pending' }),
      baseOrder({ id: '2', status: 'payment_confirmed' }),
      baseOrder({ id: '3', status: 'completed' }),
      baseOrder({ id: '4', status: 'cancelled' }),
    ];
    expect(computeOrderListStats(orders)).toEqual({ total: 4, inProgress: 2, completed: 1 });
  });

  it('derives side and counterparty from user id', () => {
    const o = baseOrder();
    expect(orderSide(o, 'buyer-1')).toBe('Buy');
    expect(orderSide(o, 'seller-1')).toBe('Sell');
    expect(counterpartyLabel(o, 'buyer-1')).toBe('bob');
    expect(counterpartyLabel(o, 'seller-1')).toBe('alice');
  });

  it('formats pair and unit price from backend fields', () => {
    const o = baseOrder();
    expect(pairLabel(o)).toBe('USDT/INR');
    expect(unitPriceDisplay(o)).toMatch(/₹92/);
  });

  it('computes time left from expires_at', () => {
    const now = Date.parse('2026-07-15T12:00:00Z');
    const o = baseOrder({
      expires_at: '2026-07-15T13:30:00Z',
      status: 'payment_pending',
    });
    expect(formatOrderTimeLeft(o, now)).toBe('1h30m');
    expect(formatOrderTimeLeft({ ...o, status: 'completed' }, now)).toBe('—');
  });

  it('detects payment proof and live refresh need', () => {
    const o = baseOrder({ payment_proof_url: 'https://x/y.png' });
    expect(hasPaymentProof(o)).toBe(true);
    expect(ordersNeedLiveRefresh([baseOrder({ status: 'completed' })])).toBe(false);
    expect(ordersNeedLiveRefresh([baseOrder({ status: 'payment_pending' })])).toBe(true);
  });

  it('labels payment method from backend', () => {
    expect(payMethodLabel(baseOrder())).toBe('UPI');
    expect(payMethodLabel(baseOrder({ seller_payment_method_name: null, seller_payment_method_code: 'bank_transfer' }))).toBe(
      'bank transfer',
    );
  });
});
