import Constants from 'expo-constants';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { readCache } from '@core/offline/readCache';
import { sessionManager } from '@core/auth/sessionManager';
import type { AuthUser, MarketListItem } from '@exchange/mobile-types';
import type { LaunchResult } from './launchFlow';

const CERT_PREVIEW_FLAG =
  Constants.expoConfig?.extra?.certPreview === true ||
  Constants.expoConfig?.extra?.certPreview === '1' ||
  process.env.EXPO_PUBLIC_CERT_PREVIEW === '1';

/** Dev-only UI certification when no backend is reachable. */
export function isCertPreviewEnabled(): boolean {
  return __DEV__ && CERT_PREVIEW_FLAG;
}

const CERT_USER: AuthUser = {
  id: 'cert-preview-user',
  email: 'cert@metheorium.com',
  phone: null,
  username: 'cert_trader',
  status: 'active',
  emailVerified: true,
  phoneVerified: false,
  tierLevel: 1,
  referralCode: 'CERT2026',
  twoFaEnabled: false,
  countryCode: 'US',
};

const CERT_MARKETS: MarketListItem[] = [
  {
    symbol: 'BTC_USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    lastPrice: 68420.5,
    changePct: 2.34,
    volume24h: 1_240_000_000,
    high24h: 69100,
    low24h: 66800,
    listedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    symbol: 'ETH_USDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    lastPrice: 3421.8,
    changePct: -1.12,
    volume24h: 620_000_000,
    high24h: 3510,
    low24h: 3380,
    listedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    symbol: 'SOL_USDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    lastPrice: 178.42,
    changePct: 5.67,
    volume24h: 210_000_000,
    high24h: 182,
    low24h: 168,
    listedAt: '2025-06-01T00:00:00.000Z',
  },
  {
    symbol: 'XRP_USDT',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    lastPrice: 0.6123,
    changePct: -0.45,
    volume24h: 95_000_000,
    high24h: 0.62,
    low24h: 0.59,
    listedAt: '2024-03-15T00:00:00.000Z',
  },
];

export async function applyCertPreviewIfEnabled(): Promise<LaunchResult | null> {
  if (!isCertPreviewEnabled()) return null;

  const accessToken = 'cert-preview-access-token';
  const refreshToken = 'cert-preview-refresh-token';

  readCache.set(CACHE_KEYS.markets, CERT_MARKETS);
  await mmkvStorage.set(CACHE_KEYS.onboarding, 'complete');
  useAppStore.getState().setOnboardingComplete(true);
  useAppStore.getState().setShellGate('none');

  useAuthStore.getState().setAuthenticated(CERT_USER, accessToken, refreshToken);
  await sessionManager.saveSession({ accessToken, refreshToken }, CERT_USER);

  if (__DEV__) {
    console.log('[cert-preview] Seeded authenticated main-app session for UI certification');
  }

  return { phase: 'main', shellGate: 'none' };
}
