import { describe, it, expect } from '@jest/globals';
import { unwrapApiData } from '@core/api/types/apiResponse';
import { ApiError } from '@core/api/errors/ApiError';
import { nextReconnectDelay, DEFAULT_RECONNECT_POLICY } from '@core/ws/reconnectPolicy';

describe('unwrapApiData', () => {
  it('unwraps success data', () => {
    const data = unwrapApiData<{ accessToken: string }>({
      success: true,
      data: { accessToken: 'abc' },
    });
    expect(data.accessToken).toBe('abc');
  });

  it('returns empty for success without data', () => {
    const data = unwrapApiData<Record<string, never>>({ success: true, message: 'ok' });
    expect(data).toEqual({});
  });
});

describe('ApiError', () => {
  it('maps envelope errors', () => {
    const err = ApiError.fromResponse(400, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid' },
    });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid');
  });
});

describe('reconnectPolicy', () => {
  it('caps delay', () => {
    const d = nextReconnectDelay(20, DEFAULT_RECONNECT_POLICY);
    expect(d).toBeLessThanOrEqual(DEFAULT_RECONNECT_POLICY.maxDelayMs * 1.2);
  });
});
