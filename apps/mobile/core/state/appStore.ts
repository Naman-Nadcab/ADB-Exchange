import { create } from 'zustand';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';

export type ShellGate =
  | 'none'
  | 'forceUpdate'
  | 'maintenance'
  | 'offline'
  | 'sanctions'
  | 'restricted'
  | 'rateLimited'
  | 'appLock';

export type AppPhase = 'boot' | 'auth' | 'onboarding' | 'main';

type AppStore = {
  phase: AppPhase;
  isOnline: boolean;
  shellGate: ShellGate;
  onboardingComplete: boolean;
  guestMode: boolean;
  language: string;
  setPhase: (phase: AppPhase) => void;
  setOnline: (online: boolean) => void;
  setShellGate: (gate: ShellGate) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setGuestMode: (guestMode: boolean) => void;
  setLanguage: (lang: string) => void;
  hydratePreferences: () => Promise<void>;
};

export const useAppStore = create<AppStore>((set) => ({
  phase: 'boot',
  isOnline: true,
  shellGate: 'none',
  onboardingComplete: false,
  guestMode: false,
  language: 'en',
  setPhase: (phase) => set({ phase }),
  setOnline: (isOnline) => set({ isOnline }),
  setShellGate: (shellGate) => set({ shellGate }),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
  setGuestMode: (guestMode) => set({ guestMode }),
  setLanguage: (language) => {
    void mmkvStorage.set(CACHE_KEYS.language, language);
    set({ language });
  },
  hydratePreferences: async () => {
    const [onboarding, language, guestMode] = await Promise.all([
      mmkvStorage.get(CACHE_KEYS.onboarding),
      mmkvStorage.get(CACHE_KEYS.language),
      mmkvStorage.get(CACHE_KEYS.guestMode),
    ]);
    set({
      onboardingComplete: onboarding === 'complete',
      language: language ?? 'en',
      guestMode: guestMode === '1',
    });
  },
}));
