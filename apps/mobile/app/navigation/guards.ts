import type { AppPhase } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';

/** Navigation guards — auth shell Sprint 1. */
export const guards = {
  canAccessMain(phase: AppPhase): boolean {
    return phase === 'main' && useAuthStore.getState().status === 'authenticated';
  },
  canAccessAuth(phase: AppPhase): boolean {
    return phase === 'auth' || phase === 'boot';
  },
  requiresAuth(route: string): boolean {
    const publicRoutes = ['Welcome', 'LoginMethod', 'LoginIdentifier', 'LoginPassword', 'SignupIdentifier'];
    return !publicRoutes.includes(route);
  },
  isSessionValid(): boolean {
    return useAuthStore.getState().status === 'authenticated' && !!useAuthStore.getState().accessToken;
  },
};
