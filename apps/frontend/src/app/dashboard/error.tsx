'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/ErrorState';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common.routeErrors');
  const tc = useTranslations('common.actions');
  return (
    <div className="dashboard-page-wrap">
      <ErrorState
        title={t('dashboardSection')}
        message={error.message || t('dashboardRetry')}
        onRetry={reset}
        retryLabel={tc('retry')}
      />
    </div>
  );
}
