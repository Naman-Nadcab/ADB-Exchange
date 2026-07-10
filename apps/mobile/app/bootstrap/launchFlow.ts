import { getAuthRepository } from '@core/repositories/AuthRepository';
import { getPublicRepository } from '@core/repositories/PublicRepository';
import { sessionManager } from '@core/auth/sessionManager';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { checkVersionGate } from './versionGate';
import { getNetworkState } from '@core/offline/netInfo';
import { appLock } from '@core/security/appLock';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import type { AuthUser } from '@exchange/mobile-types';
import { createHttpClient, resetHttpClient } from '@core/api/httpClient';
import { getApiBaseUrl } from '@core/config/env';
import { createAuthHooks } from '@core/api/authHooks';
import { ApiError } from '@core/api/errors/ApiError';

const BOOT_TIMEOUT_MS = 3000;

export type LaunchResult = {
  phase: 'auth' | 'onboarding' | 'main';
  shellGate: ReturnType<typeof useAppStore.getState>['shellGate'];
};

function mapMeUser(data: Record<string, unknown>): AuthUser {
  return {
    id: String(data.id ?? ''),
    email: data.email != null ? String(data.email) : null,
    phone: data.phone != null ? String(data.phone) : null,
    username: data.username != null ? String(data.username) : null,
    status: String(data.status ?? 'active'),
    emailVerified: Boolean(data.email_verified ?? data.emailVerified),
    phoneVerified: Boolean(data.phone_verified ?? data.phoneVerified),
    tierLevel: Number(data.tier_level ?? data.tierLevel ?? 0),
    referralCode:
      data.referralCode != null
        ? String(data.referralCode)
        : data.referral_code != null
          ? String(data.referral_code)
          : null,
    twoFaEnabled: Boolean(data.two_fa_enabled ?? data.twoFaEnabled),
    countryCode:
      data.country_code != null
        ? String(data.country_code)
        : data.countryCode != null
          ? String(data.countryCode)
          : null,
  };
}

export async function runLaunchFlow(): Promise<LaunchResult> {
  resetHttpClient();
  createHttpClient({ getBaseUrl: getApiBaseUrl, authHooks: createAuthHooks() });

  const app = useAppStore.getState();
  await app.hydratePreferences();

  const version = await checkVersionGate();
  if (version.forceUpdate) {
    useAppStore.getState().setShellGate('forceUpdate');
    return { phase: 'auth', shellGate: 'forceUpdate' };
  }

  const net = getNetworkState();
  if (!net.isConnected) {
    useAppStore.getState().setShellGate('offline');
  }

  try {
    const health = await getPublicRepository().getHealth();
    if (health.maintenance) {
      useAppStore.getState().setShellGate('maintenance');
      return { phase: 'auth', shellGate: 'maintenance' };
    }
  } catch {
    // non-blocking if health unavailable offline
  }

  useAuthStore.getState().setHydrating();
  const tokens = await sessionManager.loadTokens();

  if (tokens.accessToken && tokens.refreshToken) {
    useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
    try {
      const me = await getAuthRepository().getMe();
      const user = mapMeUser(me as unknown as Record<string, unknown>);
      useAuthStore.getState().setAuthenticated(user, tokens.accessToken, tokens.refreshToken);
      await sessionManager.saveSession(
        { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        user,
      );

      if (user.status !== 'active') {
        useAppStore.getState().setShellGate('restricted');
      }

      const lockEnabled = await appLock.isEnabled();
      if (lockEnabled) {
        const unlocked = await appLock.promptUnlock();
        if (!unlocked) useAppStore.getState().setShellGate('appLock');
      }

      const onboarding = await mmkvStorage.get(CACHE_KEYS.onboarding);
      if (onboarding !== 'complete') {
        return { phase: 'onboarding', shellGate: useAppStore.getState().shellGate };
      }
      return { phase: 'main', shellGate: useAppStore.getState().shellGate };
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SANCTIONS_BLOCKED') {
        useAppStore.getState().setShellGate('sanctions');
      }
      useAuthStore.getState().setUnauthenticated();
      await sessionManager.clearSession();
    }
  } else {
    useAuthStore.getState().setUnauthenticated();
  }

  return { phase: 'auth', shellGate: useAppStore.getState().shellGate };
}

export function waitBootTimeout(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS));
}
