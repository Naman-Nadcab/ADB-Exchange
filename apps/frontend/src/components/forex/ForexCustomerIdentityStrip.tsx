'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { useAuthStore } from '@/store/auth';

export function ForexCustomerIdentityStrip() {
  const t = useTranslations('forex.customerIdentity');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <dl className="grid gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('customerId')}</dt>
          <dd className="mt-0.5 font-mono">{userId ? String(userId) : t('unknown')}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('profile')}</dt>
          <dd className="mt-0.5">
            <Link href={ROUTES.dashboard.account} className="text-primary underline-offset-2 hover:underline">
              {t('profileLink')}
            </Link>
          </dd>
        </div>
      </dl>
    </ForexPortalModuleCard>
  );
}
