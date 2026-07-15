import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { useAppStore } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';
import {
  clearPendingAuthResume,
  consumePendingAuthResume,
  setPendingAuthResume,
} from './authIntent';
import { dismissAuthModal, openAuthScreen, resetRoot } from '@app/navigation/navigationRef';

export function isAuthenticated(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

export function isGuestSession(): boolean {
  return !isAuthenticated() && useAppStore.getState().guestMode;
}

export async function enterGuestMode(): Promise<void> {
  await mmkvStorage.set(CACHE_KEYS.guestMode, '1');
  useAppStore.getState().setGuestMode(true);
  useAppStore.getState().setPhase('main');
  resetRoot('Main');
}

export async function clearGuestMode(): Promise<void> {
  await mmkvStorage.remove(CACHE_KEYS.guestMode);
  useAppStore.getState().setGuestMode(false);
}

export async function enterGuestAfterLogout(): Promise<void> {
  await mmkvStorage.set(CACHE_KEYS.guestMode, '1');
  useAppStore.getState().setGuestMode(true);
  useAppStore.getState().setPhase('main');
  resetRoot('Main');
}

export function openLogin(onAuthed?: () => void): void {
  setPendingAuthResume(onAuthed ?? null);
  openAuthScreen('LoginPassword');
}

export function openSignup(onAuthed?: () => void): void {
  setPendingAuthResume(onAuthed ?? null);
  openAuthScreen('SignupIdentifier');
}

export function dismissAuthFromModal(): void {
  clearPendingAuthResume();
  dismissAuthModal();
}

export function requireAuthAction(onAuthed?: () => void): boolean {
  if (isAuthenticated()) {
    onAuthed?.();
    return true;
  }
  openLogin(onAuthed);
  return false;
}

/** After successful login — dismiss auth modal and resume guest intent without resetting Main. */
export function finishAuthenticatedEntry(nextPhase: 'main' | 'onboarding'): void {
  if (nextPhase === 'onboarding') {
    clearPendingAuthResume();
    resetRoot('Onboarding');
    return;
  }
  dismissAuthModal();
  consumePendingAuthResume();
}
