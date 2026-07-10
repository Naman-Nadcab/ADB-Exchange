import { describe, it, expect } from '@jest/globals';
import { guards } from '@app/navigation/guards';

describe('navigation guards', () => {
  it('requires auth for protected routes', () => {
    expect(guards.requiresAuth('LoginOtp')).toBe(true);
    expect(guards.requiresAuth('Welcome')).toBe(false);
  });

  it('allows main only when phase is main', () => {
    expect(guards.canAccessMain('main')).toBe(false);
    expect(guards.canAccessAuth('auth')).toBe(true);
  });
});
