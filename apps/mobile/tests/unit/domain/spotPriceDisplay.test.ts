import { describe, it, expect } from '@jest/globals';
import {
  resolveSpotDisplayLastPrice,
  marketRefPrice,
  normalizeFeeRate,
} from '@core/domain/trade/spotPriceDisplay';

describe('spotPriceDisplay', () => {
  it('prefers ticker last price', () => {
    expect(
      resolveSpotDisplayLastPrice({
        tickerLast: '50000',
        orderbook: { bids: [{ price: '49900', quantity: '1' }], asks: [{ price: '50100', quantity: '1' }] },
      }),
    ).toBe('50000');
  });

  it('falls back to orderbook mid', () => {
    expect(
      resolveSpotDisplayLastPrice({
        orderbook: { bids: [{ price: '100', quantity: '1' }], asks: [{ price: '102', quantity: '1' }] },
      }),
    ).toBe('101');
  });

  it('uses ask for buy market ref and bid for sell', () => {
    const book = {
      bids: [{ price: '99', quantity: '1' }],
      asks: [{ price: '101', quantity: '1' }],
    };
    expect(marketRefPrice('buy', book, '100')).toBe(101);
    expect(marketRefPrice('sell', book, '100')).toBe(99);
  });

  it('normalizes fee rates', () => {
    expect(normalizeFeeRate('0.001')).toBe(0.001);
    expect(normalizeFeeRate('0.1')).toBe(0.1);
    expect(normalizeFeeRate('10')).toBe(0.1);
  });
});
