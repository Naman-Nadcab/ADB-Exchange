'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { localizeApiError } from '@/lib/i18n/localize-api-error';

/** Maps API auth/common errors to localized customer-facing copy. */
export function useApiErrorMessage() {
  const te = useTranslations('errors');

  const translate = useCallback(
    (relativeKey: string) => {
      try {
        return te(relativeKey as Parameters<typeof te>[0]);
      } catch {
        return te('generic.unknown');
      }
    },
    [te]
  );

  const fromApi = useCallback(
    (payload: unknown, fallbackRelativeKey = 'generic.unknown') =>
      localizeApiError(payload, translate, fallbackRelativeKey),
    [translate]
  );

  const networkUnreachable = useCallback(() => te('network.unreachable'), [te]);

  return { fromApi, networkUnreachable, tError: te };
}
