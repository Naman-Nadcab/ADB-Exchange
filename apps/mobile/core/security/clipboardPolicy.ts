import * as Clipboard from 'expo-clipboard';

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Copy sensitive data and auto-clear clipboard after TTL (default 60s per MOB-001C). */
export const clipboardPolicy = {
  async copyWithExpiry(text: string, ttlMs = 60_000): Promise<void> {
    await Clipboard.setStringAsync(text);
    const key = text.slice(0, 32);
    const prev = timers.get(key);
    if (prev) clearTimeout(prev);
    timers.set(
      key,
      setTimeout(() => {
        void Clipboard.setStringAsync('');
        timers.delete(key);
      }, ttlMs),
    );
  },
  async clear(): Promise<void> {
    await Clipboard.setStringAsync('');
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  },
};
