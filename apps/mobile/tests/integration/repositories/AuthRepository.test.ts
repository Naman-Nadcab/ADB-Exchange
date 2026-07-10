import { describe, it, expect } from '@jest/globals';
import type { AuthSessionResponse } from '@exchange/mobile-types';

const mockSession: AuthSessionResponse = {
  user: {
    id: '1',
    email: 'a@b.com',
    phone: null,
    username: null,
    status: 'active',
    emailVerified: true,
    phoneVerified: false,
    tierLevel: 0,
  },
  accessToken: 'at',
  refreshToken: 'rt',
};

describe('Auth session shape', () => {
  it('matches backend contract', () => {
    expect(mockSession.accessToken).toBe('at');
    expect(mockSession.user.status).toBe('active');
  });
});
