import { describe, it, expect, beforeEach } from '@jest/globals';
import { guards } from '@app/navigation/guards';
import { useAuthStore } from '@core/state/authStore';

describe('navigation guards', () => {
  beforeEach(() => {
    useAuthStore.getState().setUnauthenticated();
  });

  it('requires auth for protected routes', () => {
    expect(guards.requiresAuth('LoginOtp')).toBe(false);
    expect(guards.requiresAuth('Welcome')).toBe(false);
    expect(guards.requiresAuth('Profile')).toBe(true);
  });

  it('allows main when phase is main regardless of auth (guest browsing)', () => {
    expect(guards.canAccessMain('main')).toBe(true);
    expect(guards.canAccessAuth('auth')).toBe(true);
    expect(guards.isAuthenticated()).toBe(false);
  });
});
