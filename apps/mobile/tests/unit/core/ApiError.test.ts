import { ApiError } from '@core/api/errors/ApiError';

describe('ApiError', () => {
  it('maps response body', () => {
    const err = ApiError.fromResponse(400, { message: 'bad', code: 'VALIDATION_ERROR' });
    expect(err.status).toBe(400);
    expect(err.message).toBe('bad');
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});
