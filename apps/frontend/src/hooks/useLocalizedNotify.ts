'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { notifyError, notifySuccess } from '@/lib/notifyError';

export function useLocalizedNotify() {
  const tc = useTranslations('common');

  const error = useCallback(
    (description: string, opts?: { title?: string; variant?: 'destructive' | 'warning' | 'default' }) => {
      notifyError(description, {
        ...opts,
        title: opts?.title ?? tc('notifications.errorTitle'),
      });
    },
    [tc]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      notifySuccess(title, description);
    },
    []
  );

  return { error, success };
}
