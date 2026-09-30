import { getApiBaseUrl } from '@/lib/getApiUrl';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';
import { useAuthStore } from '@/store/auth';

function bearerIfReal(accessToken: string | null | undefined): string | undefined {
  if (!accessToken || accessToken === COOKIE_SESSION_MARKER) return undefined;
  if (!accessToken.includes('.')) return undefined;
  return accessToken;
}

function logoutEndpoint(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/api/v1/auth/logout` : '/api/v1/auth/logout';
}

/** Revoke session server-side and clear httpOnly cookies (cookie or Bearer auth). */
export async function revokeServerSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  const bearer = bearerIfReal(useAuthStore.getState().accessToken);
  try {
    await fetch(logoutEndpoint(), {
      method: 'POST',
      credentials: 'include',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    });
  } catch {
    /* best effort */
  }
}

/** User-initiated logout: revoke session, clear local state, hard-navigate to login. */
export async function performLogout(redirectTo = '/login'): Promise<void> {
  await revokeServerSession();
  useAuthStore.getState().clearAuthState();
  if (typeof window !== 'undefined') {
    window.location.assign(redirectTo);
  }
}
