import { AuthRepository } from '@core/repositories/AuthRepository';
import { ApiError } from '@core/api/errors/ApiError';
import type { HttpClient } from '@core/api/httpClient';

describe('mobile legacy auth follows the server', () => {
  it('still posts password, OTP, and wallet login to the server routes', async () => {
    const calls: string[] = [];
    const http = {
      request: async (path: string) => {
        calls.push(path);
        return {};
      },
    } as unknown as HttpClient;
    const repo = new AuthRepository(http);
    await repo.loginPassword({ email: 'person@example.com', password: 'not-a-real-secret' });
    await repo.loginOtp({ email: 'person@example.com', otp: '000000' });
    await repo.walletLogin({
      challengeId: '00000000-0000-4000-8000-000000000000',
      message: 'message',
      signature: '0xsig',
    });
    expect(calls).toEqual([
      '/auth/login/password',
      '/auth/login',
      '/auth/wallet/login',
    ]);
  });

  it('surfaces the server wallet-sign-in sentence without a local cutoff', () => {
    const error = ApiError.fromResponse(403, {
      success: false,
      error: { code: 'LEGACY_AUTH_DISABLED', message: 'This account uses wallet sign-in.' },
    });
    expect(error.message).toBe('This account uses wallet sign-in.');
    expect(error.code).toBe('LEGACY_AUTH_DISABLED');
    expect(error.message).not.toMatch(/0x[a-fA-F0-9]{8}/);
  });
});
