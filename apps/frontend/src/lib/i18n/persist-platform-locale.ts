import { getApiBaseUrl } from '@/lib/getApiUrl';
import type { AppLocale } from '@/i18n/config';
import { appLocaleToNotificationLanguage } from '@/i18n/preference-bridge';

/**
 * Persists platform locale to existing `notificationLanguage` preference (JSONB).
 * Presentation-only — does not affect auth, trading, or compliance fields.
 */
export async function persistPlatformLocalePreference(
  accessToken: string,
  locale: AppLocale
): Promise<{ ok: boolean }> {
  const apiUrl = getApiBaseUrl();
  const notificationLanguage = appLocaleToNotificationLanguage(locale);

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ notificationLanguage }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
