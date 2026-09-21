'use server';

import { cookies } from 'next/headers';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  coerceToAppLocale,
  type AppLocale,
} from '../config';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(rawLocale: string, options?: { explicit?: boolean }) {
  const locale = coerceToAppLocale(rawLocale);
  if (!locale) {
    return { ok: false as const, error: 'unsupported_locale' };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  if (options?.explicit) {
    store.set(LOCALE_EXPLICIT_COOKIE, '1', {
      path: '/',
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return { ok: true as const, locale: locale as AppLocale };
}
