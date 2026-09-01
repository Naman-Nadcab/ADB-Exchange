import { COOKIE_SESSION_MARKER, isCookieSessionMarker } from '@/lib/authSession';
import { useAuthStore } from '@/store/auth';

/**
 * Forex private REST/WS require Authorization: Bearer <user JWT>.
 * Cookie-only sessions have no Bearer — private Forex stays unauthorized (contract gap FOREX_WS_COOKIE).
 * Never put the token in a query string.
 */
export function getForexAccessToken(): string | null {
  const storeToken = useAuthStore.getState().accessToken;
  if (isCookieSessionMarker(storeToken) || storeToken === COOKIE_SESSION_MARKER) return null;
  if (storeToken && storeToken.length > 0) return storeToken;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    const token = parsed?.state?.accessToken;
    if (isCookieSessionMarker(token) || !token) return null;
    return token;
  } catch {
    return null;
  }
}

export function getForexAccountId(): string | null {
  const id = useAuthStore.getState().user?.id;
  return id && id.trim() ? id.trim() : null;
}

export function hasForexBearer(): boolean {
  return Boolean(getForexAccessToken());
}
