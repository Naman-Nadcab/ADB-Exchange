import * as SecureStore from 'expo-secure-store';

const PREFIX = 'metheorium.secure.';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(PREFIX + key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(PREFIX + key, value);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(PREFIX + key);
  },
};

export const SECURE_KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  userId: 'user_id',
  pinHash: 'pin_hash',
} as const;
