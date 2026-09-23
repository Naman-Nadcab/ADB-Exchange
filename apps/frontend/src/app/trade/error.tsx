'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/ErrorState';

export default function TradeError({
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
        title={t('tradeSection')}
        message={error.message || t('tradeRetry')}
        onRetry={reset}
        retryLabel={tc('retry')}
      />
    </div>
  );
}
