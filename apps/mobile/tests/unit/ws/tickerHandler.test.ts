import { describe, it, expect } from '@jest/globals';
import { handleTickerMessage } from '@core/ws/messageHandlers';
import { useMarketDataStore } from '@core/state/marketDataStore';

describe('handleTickerMessage', () => {
  it('updates live store from ws payload', () => {
    useMarketDataStore.getState().clearLive();
    handleTickerMessage({
      type: 'ticker',
      channel: 'ticker:BTC_USDT',
      data: {
        symbol: 'BTC_USDT',
        last_price: '51000',
        price_change_pct_24h: '3.5',
        volume_24h: '2000000',
        high_24h: '52000',
        low_24h: '49000',
      },
    });
    const live = useMarketDataStore.getState().live.BTC_USDT;
    expect(live?.lastPrice).toBe(51000);
    expect(live?.changePct).toBe(3.5);
  });
});
