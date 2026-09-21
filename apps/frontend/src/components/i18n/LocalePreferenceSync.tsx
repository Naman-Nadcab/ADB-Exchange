'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { syncAccountLocalePreferenceAction } from '@/i18n/actions/sync-preference-locale';

/**
 * Syncs account `notificationLanguage` into the locale preference cookie.
 * Does not override explicit manual language selection (handled server-side).
 */
export function LocalePreferenceSync() {
  const { accessToken, isAuthenticated, _hasHydrated } = useAuthStore();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !accessToken || syncedRef.current) return;
    syncedRef.current = true;

    const apiUrl = getApiBaseUrl();
    fetch(`${apiUrl}/api/v1/auth/preferences`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const lang = data?.notificationLanguage ?? data?.preferences?.notificationLanguage;
        if (typeof lang === 'string') {
          return syncAccountLocalePreferenceAction(lang);
        }
        return null;
      })
      .catch(() => undefined);
  }, [_hasHydrated, isAuthenticated, accessToken]);

  return null;
}
