'use server';

import { cookies } from 'next/headers';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
} from '../config';
import { parseExplicitFlag, parseLocaleCookieValue } from '../cookie-locale';
import { notificationLanguageToAppLocale } from '../preference-bridge';

const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieOpts = {
  path: '/',
  maxAge: ONE_YEAR,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

/** Account preference cookie — never overrides explicit manual selection. */
export async function syncAccountLocalePreferenceAction(notificationLanguage: string) {
  const locale = notificationLanguageToAppLocale(notificationLanguage);
  if (!locale) return { ok: false as const };

  const store = await cookies();
  if (parseExplicitFlag(store.get(LOCALE_EXPLICIT_COOKIE)?.value)) {
    return { ok: true as const, skipped: true as const };
  }

  store.set(LOCALE_PREF_COOKIE, locale, cookieOpts);
  store.set(LOCALE_COOKIE, locale, cookieOpts);

  return { ok: true as const, locale };
}
