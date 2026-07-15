import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { sessionManager } from '@core/auth/sessionManager';
import { withRefreshMutex } from '@core/auth/refreshMutex';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { secureStorage, SECURE_KEYS } from '@core/storage/secureStorage';
import { enterGuestAfterLogout } from '@core/guest/guestMode';
import { resetRoot } from '@app/navigation/navigationRef';

export type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
};

export type AuthHooks = {
  getSession: () => AuthSession;
  onRefreshRequired: () => Promise<string | null>;
  onSessionCleared: () => void;
};

export function createAuthHooks(): AuthHooks {
  return {
    getSession: () => {
      const { accessToken, refreshToken } = useAuthStore.getState();
      return { accessToken, refreshToken };
    },
    onRefreshRequired: () =>
      withRefreshMutex(async () => {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) return null;
        try {
          const data = await getAuthRepository().refresh(refreshToken);
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
          const user = useAuthStore.getState().user;
          if (user) {
            await sessionManager.saveSession(
              { accessToken: data.accessToken, refreshToken: data.refreshToken },
              user,
            );
          } else {
            await secureStorage.set(SECURE_KEYS.accessToken, data.accessToken);
            await secureStorage.set(SECURE_KEYS.refreshToken, data.refreshToken);
          }
          return data.accessToken;
        } catch {
          return null;
        }
      }),
    onSessionCleared: () => {
      void sessionManager.clearSession();
      useAuthStore.getState().setUnauthenticated();
      useAppStore.getState().setShellGate('none');
      void enterGuestAfterLogout();
      resetRoot('Main');
    },
  };
}
