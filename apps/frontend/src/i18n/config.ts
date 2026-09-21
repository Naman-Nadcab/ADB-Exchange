/**
 * Tier-1 i18n locale configuration (presentation only).
 * Does not affect trading, wallet, or compliance logic.
 */
export const APP_LOCALES = ['en', 'zh-CN', 'id-ID'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_COOKIE = 'mlive_locale';
export const LOCALE_EXPLICIT_COOKIE = 'mlive_locale_explicit';
export const LOCALE_PREF_COOKIE = 'mlive_locale_pref';

/** BCP-47 tags exposed to `<html lang>` and Intl formatters. */
export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  en: 'en',
  'zh-CN': 'zh-CN',
  'id-ID': 'id',
};

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'id-ID': 'Bahasa Indonesia',
};

export const MESSAGE_NAMESPACES = [
  'common',
  'navigation',
  'auth',
  'security',
  'crypto',
  'forex',
  'p2p',
  'wallet',
  'orders',
  'errors',
  'notifications',
] as const;

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  if (!value) return false;
  return (APP_LOCALES as readonly string[]).includes(value);
}

/** Maps legacy / preference codes to canonical app locales. */
export function coerceToAppLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) return null;
  const v = raw.trim();
  if (isAppLocale(v)) return v;
  const lower = v.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
  if (lower === 'id' || lower === 'id-id' || lower === 'id_id') return 'id-ID';
  return null;
}
