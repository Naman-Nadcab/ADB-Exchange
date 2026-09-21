import { coerceToAppLocale, type AppLocale } from './config';

/** Max length for locale cookie values (injection / abuse guard). */
export const LOCALE_COOKIE_MAX_LEN = 16;

/**
 * Parse a locale cookie value safely.
 * Returns null for malformed, oversized, or unsupported values.
 */
export function parseLocaleCookieValue(raw: string | undefined | null): AppLocale | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > LOCALE_COOKIE_MAX_LEN) return null;
  return coerceToAppLocale(trimmed);
}

export function parseExplicitFlag(raw: string | undefined | null): boolean {
  return raw === '1';
}
