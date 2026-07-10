import { describe, it, expect } from '@jest/globals';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';

describe('formatPrice', () => {
  it('formats large prices', () => {
    expect(formatPrice(50000, 'USDT')).toContain('50');
  });

  it('formats change pct', () => {
    expect(formatChangePct(2.5)).toBe('+2.50%');
    expect(formatChangePct(-1)).toBe('-1.00%');
  });

  it('maps change colors', () => {
    expect(changeColorKey(1)).toBe('buy');
    expect(changeColorKey(-1)).toBe('sell');
  });
});
