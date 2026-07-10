import { create } from 'zustand';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import type { UserPreferences } from '@exchange/mobile-types';

const PREFS_KEY = 'account.localPrefs';

type SettingsPrefsStore = {
  prefs: UserPreferences;
  hydrated: boolean;
  hydrate: () => void;
  setPrefs: (patch: Partial<UserPreferences>) => void;
  reset: () => void;
};

const defaults: UserPreferences = {
  theme: 'system',
  language: 'en',
  currency: 'USD',
  timezone: 'UTC',
  sound_enabled: true,
  haptics_enabled: true,
  notifications: {
    price_alerts: true,
    p2p_alerts: true,
    trading_alerts: true,
    security_alerts: true,
    marketing: false,
  },
};

export const useSettingsPrefsStore = create<SettingsPrefsStore>((set, get) => ({
  prefs: { ...defaults },
  hydrated: false,
  hydrate: () => {
    const raw = mmkvStorage.getString(PREFS_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    try {
      set({ prefs: { ...defaults, ...JSON.parse(raw) }, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    mmkvStorage.set(PREFS_KEY, JSON.stringify(prefs));
    set({ prefs });
  },
  reset: () => {
    void mmkvStorage.remove(PREFS_KEY);
    set({ prefs: { ...defaults } });
  },
}));
