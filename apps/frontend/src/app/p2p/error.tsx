'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/ErrorState';

export default function P2PError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common.routeErrors');
  const tc = useTranslations('common.actions');
  return (
    <div className="p-4 md:p-6">
      <ErrorState
        title={t('p2pSection')}
        message={error.message || t('p2pRetry')}
        onRetry={reset}
        retryLabel={tc('retry')}
      />
    </div>
  );
}
