import type { AppLocale } from './config';
import { coerceToAppLocale } from './config';

/**
 * Maps platform UI locale ↔ legacy `users.preferences.notificationLanguage`.
 *
 * Backend stores notification templates language hint; UI treats it as the
 * user's saved platform language when no explicit manual override exists.
 * No DB schema change — values remain short codes in JSONB.
 */
export function appLocaleToNotificationLanguage(locale: AppLocale): string {
  switch (locale) {
    case 'zh-CN':
      return 'zh';
    case 'id-ID':
      return 'id';
    default:
      return 'en';
  }
}

export function notificationLanguageToAppLocale(raw: string | null | undefined) {
  return coerceToAppLocale(raw);
}
