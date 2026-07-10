import { mmkvStorage } from '@core/storage/mmkvStorage';

const PREFIX = 'cache.read.';

export const readCache = {
  get<T>(key: string): T | null {
    const raw = mmkvStorage.getString(PREFIX + key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { value: T; savedAt: number };
      return parsed.value;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    mmkvStorage.set(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  },

  getSavedAt(key: string): number | null {
    const raw = mmkvStorage.getString(PREFIX + key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { savedAt: number }).savedAt;
    } catch {
      return null;
    }
  },
};
