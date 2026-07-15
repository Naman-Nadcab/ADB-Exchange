import type { AppPhase } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';

const PUBLIC_AUTH_ROUTES = new Set([
  'Welcome',
  'LoginMethod',
  'LoginIdentifier',
  'LoginPassword',
  'LoginOtp',
  'LoginPasskey',
  'SignupIdentifier',
  'SignupOtp',
  'SignupPassword',
  'SignupReferral',
  'ForgotPasswordRequest',
  'ForgotPasswordOtp',
  'ForgotPasswordNew',
  'OAuthCallback',
]);

/** Navigation guards — guest mode + protected actions. */
export const guards = {
  canAccessMain(phase: AppPhase): boolean {
    return phase === 'main';
  },
  canAccessAuth(phase: AppPhase): boolean {
    return phase === 'auth' || phase === 'boot';
  },
  isAuthenticated(): boolean {
    return useAuthStore.getState().status === 'authenticated';
  },
  requiresAuth(route: string): boolean {
    return !PUBLIC_AUTH_ROUTES.has(route);
  },
  isSessionValid(): boolean {
    return useAuthStore.getState().status === 'authenticated' && !!useAuthStore.getState().accessToken;
  },
};
