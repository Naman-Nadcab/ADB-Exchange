/** Locale preference cookies — non-HttpOnly; same Secure rules as auth cookies on plain HTTP staging. */

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Browsers ignore Secure cookies on plain HTTP — honor proxy proto / AUTH_COOKIE_SECURE override. */
export function resolveLocaleCookieSecure(forwardedProto?: string | null): boolean {
  const envOverride = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (envOverride === 'false' || envOverride === '0') return false;
  if (envOverride === 'true' || envOverride === '1') return true;

  if (forwardedProto) {
    const proto = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (proto === 'https') return true;
    if (proto === 'http') return false;
  }

  return process.env.NODE_ENV === 'production';
}

export function localeCookieSetOptions(forwardedProto?: string | null) {
  return {
    path: '/' as const,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    secure: resolveLocaleCookieSecure(forwardedProto),
  };
}
