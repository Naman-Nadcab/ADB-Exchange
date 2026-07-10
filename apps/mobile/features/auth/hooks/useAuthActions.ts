import { useCallback } from 'react';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { sessionManager } from '@core/auth/sessionManager';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import type { AuthSessionResponse, AuthUser } from '@exchange/mobile-types';
import { ApiError } from '@core/api/errors/ApiError';

function mapUser(user: AuthUser): AuthUser {
  return user;
}

export function useAuthActions() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const setShellGate = useAppStore((s) => s.setShellGate);
  const setPhase = useAppStore((s) => s.setPhase);

  const completeSession = useCallback(
    async (session: AuthSessionResponse) => {
      const user = mapUser(session.user);
      setAuthenticated(user, session.accessToken, session.refreshToken);
      await sessionManager.saveSession(
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        user,
      );
      if (user.status !== 'active') {
        setShellGate('restricted');
        return;
      }
      const onboarding = await mmkvStorage.get(CACHE_KEYS.onboarding);
      setPhase(onboarding === 'complete' ? 'main' : 'onboarding');
    },
    [setAuthenticated, setPhase, setShellGate],
  );

  const logout = useCallback(async () => {
    try {
      await getAuthRepository().logout();
    } catch {
      // still clear local session
    }
    await sessionManager.clearSession();
    setUnauthenticated();
    setPhase('auth');
  }, [setPhase, setUnauthenticated]);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED' || err.status === 429) {
          setShellGate('rateLimited');
          return err.message;
        }
        if (err.code === 'SANCTIONS_BLOCKED') {
          setShellGate('sanctions');
          return err.message;
        }
        return err.message;
      }
      if (err instanceof Error) return err.message;
      return 'Something went wrong';
    },
    [setShellGate],
  );

  return { completeSession, logout, handleAuthError };
}
