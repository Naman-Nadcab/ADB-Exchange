import { computeMarketContext, computeMarketPulse } from '@core/domain/trade/marketPulse';
import { groupBookLevels, computeBookSentiment, cumulativeTotals } from '@core/domain/trade/orderbookPanel';

describe('marketPulse', () => {
  it('computes 24h range position', () => {
    const ctx = computeMarketContext({ high: 110, low: 90, last: 100 });
    expect(ctx?.positionPct).toBeCloseTo(50, 0);
  });

  it('computes momentum from change pct', () => {
    const pulse = computeMarketPulse({ changePct: 1.5, orderbook: { bids: [], asks: [], symbol: 'BTC_USDT' } });
    expect(pulse.momentum).toBe('Up');
  });
});

describe('orderbookPanel', () => {
  it('groups levels by tick size', () => {
    const grouped = groupBookLevels(
      [
        { price: '100.001', quantity: '1' },
        { price: '100.002', quantity: '2' },
      ],
      2,
      'buy',
    );
    expect(grouped.length).toBe(1);
    expect(parseFloat(grouped[0]!.quantity)).toBe(3);
  });

  it('computes cumulative totals', () => {
    const levels = groupBookLevels([{ price: '100', quantity: '1' }, { price: '99', quantity: '2' }], 2, 'buy');
    const { totals, maxCum } = cumulativeTotals(levels);
    expect(totals.length).toBe(2);
    expect(maxCum).toBeGreaterThan(0);
  });

  it('computes sentiment split', () => {
    const bids = groupBookLevels([{ price: '100', quantity: '10' }], 2, 'buy');
    const asks = groupBookLevels([{ price: '101', quantity: '1' }], 2, 'sell');
    const s = computeBookSentiment(bids, asks);
    expect(s.buyPct).toBeGreaterThan(50);
  });
});
