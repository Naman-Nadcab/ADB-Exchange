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
