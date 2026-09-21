'use server';

import { cookies } from 'next/headers';
import {
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
  coerceToAppLocale,
} from '../config';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Account preference cookie — lower priority than explicit manual selection. */
export async function syncAccountLocalePreferenceAction(notificationLanguage: string) {
  const locale = coerceToAppLocale(notificationLanguage);
  if (!locale) return { ok: false as const };

  const store = await cookies();
  if (store.get(LOCALE_EXPLICIT_COOKIE)?.value === '1') {
    return { ok: true as const, skipped: true as const };
  }

  store.set(LOCALE_PREF_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return { ok: true as const, locale };
}
