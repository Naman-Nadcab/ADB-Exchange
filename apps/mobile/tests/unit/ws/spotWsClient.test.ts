import { describe, it, expect, beforeAll } from '@jest/globals';
import { SpotWsClient } from '@core/ws/SpotWsClient';

/** jest-expo has no WebSocket global; subscribe() compares against WebSocket.OPEN. */
beforeAll(() => {
  if (typeof global.WebSocket === 'undefined') {
    global.WebSocket = { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 } as unknown as typeof WebSocket;
  }
});

/** Runtime dispatch verification without WebSocket transport. */
function dispatch(client: SpotWsClient, message: unknown) {
  (client as unknown as { routeMessage: (message: unknown) => void }).routeMessage(message);
}

describe('SpotWsClient routeMessage dispatch (runtime)', () => {
  it('invokes channel handler once per ticker message', () => {
    const client = new SpotWsClient({ getWsUrl: () => 'ws://test/ws' });
    let count = 0;
    client.addHandler('ticker:BTC_USDT', () => {
      count += 1;
    });

    dispatch(client, { type: 'ticker', channel: 'ticker:BTC_USDT', data: { last: '1' } });

    expect(count).toBe(1);
  });

  it('invokes channel handler once per orderbook_update message', () => {
    const client = new SpotWsClient({ getWsUrl: () => 'ws://test/ws' });
    let count = 0;
    client.addHandler('orderbook:BTC_USDT', () => {
      count += 1;
    });

    dispatch(client, { type: 'orderbook_update', channel: 'orderbook:BTC_USDT', data: {} });

    expect(count).toBe(1);
  });

  it('invokes channel handler once per trades message', () => {
    const client = new SpotWsClient({ getWsUrl: () => 'ws://test/ws' });
    let count = 0;
    client.addHandler('trades:BTC_USDT', () => {
      count += 1;
    });

    dispatch(client, { type: 'trades', channel: 'trades:BTC_USDT', data: [] });

    expect(count).toBe(1);
  });

  it('does not call connect() when subscribe() runs after disconnect()', () => {
    const client = new SpotWsClient({ getWsUrl: () => 'ws://test/ws' });
    const connectSpy = jest.spyOn(client, 'connect').mockImplementation(() => undefined);
    client.disconnect();
    client.subscribe('ticker:BTC_USDT');
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });

  it('calls connect() on subscribe() when socket is absent and reconnect is allowed', () => {
    const client = new SpotWsClient({ getWsUrl: () => 'ws://test/ws' });
    const connectSpy = jest.spyOn(client, 'connect').mockImplementation(() => undefined);
    client.subscribe('ticker:BTC_USDT');
    expect(connectSpy).toHaveBeenCalledTimes(1);
    connectSpy.mockRestore();
  });
});
