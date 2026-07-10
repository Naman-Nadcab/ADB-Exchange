import { nextReconnectDelay, DEFAULT_RECONNECT_POLICY } from '@core/ws/reconnectPolicy';

describe('reconnectPolicy', () => {
  it('caps delay at max', () => {
    const delay = nextReconnectDelay(20, DEFAULT_RECONNECT_POLICY);
    expect(delay).toBeLessThanOrEqual(DEFAULT_RECONNECT_POLICY.maxDelayMs * 1.2);
  });
});
