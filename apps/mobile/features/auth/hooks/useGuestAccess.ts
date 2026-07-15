import { useCallback } from 'react';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import {
  enterGuestMode,
  openLogin,
  openSignup,
  requireAuthAction,
} from '@core/guest/guestMode';

export function useGuestAccess() {
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const guestMode = useAppStore((s) => s.guestMode);
  const isGuest = !isAuthenticated && guestMode;

  const continueAsGuest = useCallback(() => {
    void enterGuestMode();
  }, []);

  const requireAuth = useCallback((onAuthed?: () => void) => requireAuthAction(onAuthed), []);

  return {
    isAuthenticated,
    isGuest,
    continueAsGuest,
    openLogin: useCallback(() => openLogin(), []),
    openSignup: useCallback(() => openSignup(), []),
    requireAuth,
  };
}
