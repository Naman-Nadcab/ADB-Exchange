/** In-memory marker: session is cookie-backed; do not send Bearer header. */
export const COOKIE_SESSION_MARKER = '__cookie_session__';

export function isCookieSessionMarker(token: string | null | undefined): boolean {
  return token === COOKIE_SESSION_MARKER;
}

export function hasActiveSession(accessToken: string | null | undefined, isAuthenticated: boolean): boolean {
  return isAuthenticated || (!!accessToken && accessToken.length > 0);
}

/** Client UI/API fetch gate: cookie sessions may have no persisted accessToken until /me completes. */
export function isClientAuthed(
  hasHydrated: boolean,
  isAuthenticated: boolean,
  authResolved = true,
): boolean {
  return hasHydrated && authResolved && isAuthenticated;
}

/**
 * Login URL that returns the visitor to the page they were on.
 * Unsafe or auth paths stay on `/login` so the redirect cannot leave the site.
 */
export function loginPathWithRedirect(pathname: string, search = ''): string {
  const path = pathname.trim();
  const blocked =
    path.length === 0 ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\') ||
    path.includes('\\') ||
    path.includes('://') ||
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/signup' ||
    path.startsWith('/signup/') ||
    path === '/register' ||
    path.startsWith('/register/');
  if (blocked) return '/login';
  const query = search.startsWith('?') ? search : search.length > 0 ? `?${search}` : '';
  return `/login?redirect=${encodeURIComponent(`${path}${query}`)}`;
}
