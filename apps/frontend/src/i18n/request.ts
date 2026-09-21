import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
  LOCALE_HTML_LANG,
  type AppLocale,
  isAppLocale,
} from './config';
import { parseExplicitFlag, parseLocaleCookieValue } from './cookie-locale';
import { resolveLocaleWithSource } from './locale-resolver';
import { loadMessagesForLocale } from './load-messages';

function readRegionCode(headerStore: Headers): string | null {
  return (
    headerStore.get('cf-ipcountry') ||
    headerStore.get('x-vercel-ip-country') ||
    headerStore.get('x-country-code') ||
    headerStore.get('x-app-region') ||
    null
  );
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const explicitSelection = parseExplicitFlag(cookieStore.get(LOCALE_EXPLICIT_COOKIE)?.value);
  const localeCookie = parseLocaleCookieValue(cookieStore.get(LOCALE_COOKIE)?.value);
  const preferenceCookie = parseLocaleCookieValue(cookieStore.get(LOCALE_PREF_COOKIE)?.value);

  const { effectiveLocale } = resolveLocaleWithSource({
    preferenceCookie,
    localeCookie,
    explicitSelection,
    regionCode: explicitSelection ? null : readRegionCode(headerStore),
    acceptLanguage: headerStore.get('accept-language'),
  });

  const locale: AppLocale = isAppLocale(effectiveLocale) ? effectiveLocale : DEFAULT_LOCALE;
  const messages = await loadMessagesForLocale(locale);

  return {
    locale,
    messages,
  };
});

export function localeToHtmlLang(locale: AppLocale): string {
  return LOCALE_HTML_LANG[locale] ?? 'en';
}
