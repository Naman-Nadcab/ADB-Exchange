'use server';

import { cookies } from 'next/headers';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
  type AppLocale,
} from '../config';
import { parseExplicitFlag, parseLocaleCookieValue } from '../cookie-locale';

const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieOpts = {
  path: '/',
  maxAge: ONE_YEAR,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function setLocaleAction(rawLocale: string, options?: { explicit?: boolean }) {
  const locale = parseLocaleCookieValue(rawLocale);
  if (!locale) {
    return { ok: false as const, error: 'unsupported_locale' };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, cookieOpts);

  if (options?.explicit) {
    store.set(LOCALE_EXPLICIT_COOKIE, '1', cookieOpts);
    store.set(LOCALE_PREF_COOKIE, locale, cookieOpts);
  }

  return { ok: true as const, locale: locale as AppLocale };
}

/** Clear explicit override (e.g. reset to account default) — not exposed in UI Phase 1.1 */
export async function clearExplicitLocaleAction() {
  const store = await cookies();
  if (parseExplicitFlag(store.get(LOCALE_EXPLICIT_COOKIE)?.value)) {
    store.delete(LOCALE_EXPLICIT_COOKIE);
  }
  return { ok: true as const };
}
