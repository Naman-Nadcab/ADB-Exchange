/** MMKV abstraction — in-memory fallback for tests / Expo Go without native MMKV. */

type Store = Map<string, string>;

const memoryStore: Store = new Map();
let mmkvInstance: { getString: (k: string) => string | undefined; set: (k: string, v: string) => void } | null =
  null;

function getStore() {
  if (mmkvInstance) return mmkvInstance;
  return {
    getString: (k: string) => memoryStore.get(k),
    set: (k: string, v: string) => void memoryStore.set(k, v),
  };
}

export function initMmkv(native: typeof mmkvInstance) {
  mmkvInstance = native;
}

export const mmkvStorage = {
  getString(key: string): string | undefined {
    return getStore().getString(key);
  },
  async get(key: string): Promise<string | undefined> {
    return getStore().getString(key);
  },
  set(key: string, value: string): void {
    getStore().set(key, value);
  },
  async remove(key: string): Promise<void> {
    memoryStore.delete(key);
    if (mmkvInstance && 'delete' in mmkvInstance) {
      (mmkvInstance as { delete: (k: string) => void }).delete(key);
    }
  },
};
