import { buildEscrowTimeline, validateOrderQuantity, getAdPrice, getAdSide, displayOrderStatus } from '@core/domain/p2p/order';

describe('p2p order domain', () => {
  it('validates quantity against limits', () => {
    expect(validateOrderQuantity('0', '10', '100', '50')).toMatch(/valid/);
    expect(validateOrderQuantity('5', '10', '100', '50')).toMatch(/Minimum/);
    expect(validateOrderQuantity('200', '10', '100', '50')).toMatch(/Maximum/);
    expect(validateOrderQuantity('60', '10', '100', '50')).toMatch(/Exceeds/);
    expect(validateOrderQuantity('25', '10', '100', '50')).toBeNull();
  });

  it('builds escrow timeline from backend status', () => {
    const steps = buildEscrowTimeline('payment_pending');
    expect(steps.find((s) => s.key === 'payment_pending')?.active).toBe(true);
    expect(steps.find((s) => s.key === 'released')?.done).toBe(false);
  });

  it('maps display status', () => {
    expect(displayOrderStatus('released')).toBe('Released');
  });

  it('reads ad side and price from backend fields', () => {
    expect(getAdSide({ ad_type: 'sell' })).toBe('sell');
    expect(getAdPrice({ current_price: '99', price: '1' })).toBe('99');
  });
});
