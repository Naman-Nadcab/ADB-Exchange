import Constants from 'expo-constants';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { sessionManager } from '@core/auth/sessionManager';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import type { LaunchResult } from './launchFlow';

const AUTH_PREVIEW_FLAG =
  Constants.expoConfig?.extra?.authPreview === true ||
  Constants.expoConfig?.extra?.authPreview === '1' ||
  process.env.EXPO_PUBLIC_AUTH_PREVIEW === '1';

/** Dev-only forced logged-out auth / onboarding for Phase 1 screenshots. */
export function isAuthPreviewEnabled(): boolean {
  return __DEV__ && AUTH_PREVIEW_FLAG;
}

export function getAuthPreviewPhase(): 'auth' | 'onboarding' {
  const phase = process.env.EXPO_PUBLIC_AUTH_PREVIEW_PHASE;
  return phase === 'onboarding' ? 'onboarding' : 'auth';
}

export function getAuthPreviewScreen(): string | null {
  const screen = process.env.EXPO_PUBLIC_AUTH_PREVIEW_SCREEN;
  return screen?.trim() ? screen.trim() : null;
}

export function getAuthPreviewParams(): Record<string, unknown> {
  const raw = process.env.EXPO_PUBLIC_AUTH_PREVIEW_PARAMS;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function applyAuthPreviewIfEnabled(): Promise<LaunchResult | null> {
  if (!isAuthPreviewEnabled()) return null;

  await sessionManager.clearSession();
  useAuthStore.getState().setUnauthenticated();
  useAppStore.getState().setGuestMode(false);
  await mmkvStorage.remove(CACHE_KEYS.guestMode);
  useAppStore.getState().setShellGate('none');

  const phase = getAuthPreviewPhase();
  if (__DEV__) {
    console.log(`[auth-preview] Forced ${phase} phase (logged out)`);
  }

  return { phase, shellGate: 'none' };
}
