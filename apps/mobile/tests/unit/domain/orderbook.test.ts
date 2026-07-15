import { describe, it, expect } from '@jest/globals';
import { applyOrderbookDelta, validateOrder } from '@core/domain/trade/orderbook';
import type { OrderbookSnapshot, SpotMarket } from '@exchange/mobile-types';

const snapshot: OrderbookSnapshot = {
  symbol: 'BTC_USDT',
  bids: [{ price: '100', quantity: '1' }],
  asks: [{ price: '101', quantity: '2' }],
  lastUpdateId: 1,
};

const market: SpotMarket = {
  id: '1',
  symbol: 'BTC_USDT',
  base_asset: 'BTC',
  quote_asset: 'USDT',
  status: 'active',
  min_qty: '0.001',
  min_notional: '10',
  price_precision: 2,
  qty_precision: 6,
};

describe('orderbook domain', () => {
  it('applies delta', () => {
    const next = applyOrderbookDelta(snapshot, {
      symbol: 'BTC_USDT',
      seq: 2,
      bids: [['100', '2']],
      asks: [['101', '0']],
    });
    expect(next.bids[0].quantity).toBe('2');
    expect(next.asks.length).toBe(0);
  });

  it('validates limit order', () => {
    const r = validateOrder(
      { market: 'BTC_USDT', side: 'buy', type: 'limit', quantity: '0.01', price: '50000' },
      market,
    );
    expect(r.valid).toBe(true);
  });

  it('rejects low quantity', () => {
    const r = validateOrder(
      { market: 'BTC_USDT', side: 'buy', type: 'market', quantity: '0.0001' },
      market,
    );
    expect(r.valid).toBe(false);
  });

  it('validates trailing stop delta', () => {
    const ok = validateOrder(
      { market: 'BTC_USDT', side: 'sell', type: 'trailing_stop_market', quantity: '0.01', trailing_delta: '2' },
      market,
    );
    expect(ok.valid).toBe(true);
    const bad = validateOrder(
      { market: 'BTC_USDT', side: 'sell', type: 'trailing_stop_market', quantity: '0.01', trailing_delta: '150' },
      market,
    );
    expect(bad.valid).toBe(false);
  });

  it('rejects post-only with IOC', () => {
    const r = validateOrder(
      {
        market: 'BTC_USDT',
        side: 'buy',
        type: 'limit',
        quantity: '0.01',
        price: '50000',
        post_only: true,
        time_in_force: 'ioc',
      },
      market,
    );
    expect(r.valid).toBe(false);
  });
});
