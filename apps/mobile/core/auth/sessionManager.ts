import { secureStorage, SECURE_KEYS } from '@core/storage/secureStorage';
import type { AuthUser } from '@exchange/mobile-types';

export type PersistedSession = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
};

export const sessionManager = {
  async loadTokens(): Promise<PersistedSession> {
    const [accessToken, refreshToken, userId] = await Promise.all([
      secureStorage.get(SECURE_KEYS.accessToken),
      secureStorage.get(SECURE_KEYS.refreshToken),
      secureStorage.get(SECURE_KEYS.userId),
    ]);
    return { accessToken, refreshToken, userId };
  },

  async saveSession(tokens: { accessToken: string; refreshToken: string }, user: AuthUser) {
    await Promise.all([
      secureStorage.set(SECURE_KEYS.accessToken, tokens.accessToken),
      secureStorage.set(SECURE_KEYS.refreshToken, tokens.refreshToken),
      secureStorage.set(SECURE_KEYS.userId, user.id),
    ]);
  },

  async clearSession() {
    await Promise.all([
      secureStorage.remove(SECURE_KEYS.accessToken),
      secureStorage.remove(SECURE_KEYS.refreshToken),
      secureStorage.remove(SECURE_KEYS.userId),
    ]);
  },
};
