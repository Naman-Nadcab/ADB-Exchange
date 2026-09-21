'use server';

import { cookies, headers } from 'next/headers';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
} from '../config';
import { parseExplicitFlag, parseLocaleCookieValue } from '../cookie-locale';
import { notificationLanguageToAppLocale } from '../preference-bridge';
import { localeCookieSetOptions } from '../locale-cookie-options';

/** Account preference cookie — never overrides explicit manual selection. */
export async function syncAccountLocalePreferenceAction(notificationLanguage: string) {
  const locale = notificationLanguageToAppLocale(notificationLanguage);
  if (!locale) return { ok: false as const };

  const headerStore = await headers();
  const cookieOpts = localeCookieSetOptions(headerStore.get('x-forwarded-proto'));

  const store = await cookies();
  if (parseExplicitFlag(store.get(LOCALE_EXPLICIT_COOKIE)?.value)) {
    return { ok: true as const, skipped: true as const };
  }

  store.set(LOCALE_PREF_COOKIE, locale, cookieOpts);
  store.set(LOCALE_COOKIE, locale, cookieOpts);

  return { ok: true as const, locale };
}
