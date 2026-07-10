import { describe, it, expect, jest } from '@jest/globals';
import { SubscriptionManager } from '@core/ws/subscriptionManager';
import type { SpotWsClient } from '@core/ws/SpotWsClient';

function mockClient(): SpotWsClient {
  return {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    addHandler: jest.fn(() => jest.fn()),
  } as unknown as SpotWsClient;
}

describe('SubscriptionManager', () => {
  it('refcounts ticker subscriptions', () => {
    const client = mockClient();
    const mgr = new SubscriptionManager(client);
    const a = mgr.subscribeTicker('BTC_USDT');
    const b = mgr.subscribeTicker('BTC_USDT');
    expect(client.subscribe).toHaveBeenCalledTimes(1);
    a();
    expect(client.unsubscribe).not.toHaveBeenCalled();
    b();
    expect(client.unsubscribe).toHaveBeenCalledWith('ticker:BTC_USDT');
  });

  it('clears all subscriptions', () => {
    const client = mockClient();
    const mgr = new SubscriptionManager(client);
    mgr.subscribeTicker('ETH_USDT')();
    mgr.clear();
    expect(client.unsubscribe).toHaveBeenCalled();
  });
});
