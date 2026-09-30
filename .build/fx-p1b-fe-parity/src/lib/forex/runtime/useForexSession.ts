'use client';

/**
 * Reactive Forex session gate.
 *
 * `hasForexPrivateSession()` reads `useAuthStore.getState()`, which does not
 * subscribe. The auth store uses `skipHydration`, so on first paint
 * `isAuthenticated` is false and a component that only calls the plain function
 * never re-renders when auth resolves — an authenticated trader keeps seeing the
 * sign-in placeholder. Components must use this hook instead.
 *
 * Authentication itself is unchanged: a signed-out visitor still resolves to
 * SIGNED_OUT and private REST still requires the cookie or Bearer.
 */
import { isCookieSessionMarker } from '@/lib/authSession';
import { useAuthStore } from '@/store/auth';

export type ForexSessionStatus = 'RESOLVING' | 'AUTHENTICATED' | 'SIGNED_OUT';

export type ForexSession = {
  status: ForexSessionStatus;
  /** True only when a private Forex call can be attempted. */
  authed: boolean;
  /** True while persist rehydration is still in flight — render a loader, not a sign-in prompt. */
  resolving: boolean;
  accountId: string | null;
};

export function useForexSession(): ForexSession {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const accountId = useAuthStore((s) => s.user?.id ?? null);

  const bearer = Boolean(accessToken && !isCookieSessionMarker(accessToken));
  const authed = bearer || Boolean(isAuthenticated);

  if (authed) {
    return { status: 'AUTHENTICATED', authed: true, resolving: false, accountId };
  }
  if (!hasHydrated) {
    return { status: 'RESOLVING', authed: false, resolving: true, accountId: null };
  }
  return { status: 'SIGNED_OUT', authed: false, resolving: false, accountId: null };
}

/** Boolean-only helper for components that just gate a control. */
export function useForexPrivateSession(): boolean {
  return useForexSession().authed;
}
