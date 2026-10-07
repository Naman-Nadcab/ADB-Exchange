'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CUSTOMER_ACCOUNT_ROUTES } from '@/lib/account/customer-account';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { useAuthStore } from '@/store/auth';

export function ForexCustomerIdentityStrip() {
  const t = useTranslations('forex.customerIdentity');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || null;

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('customerId')}</dt>
          <dd className="mt-0.5 font-mono">{userId ? String(userId) : t('unknown')}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('displayName')}</dt>
          <dd className="mt-0.5">{name ?? t('nameUnset')}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{t('kycNote')}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
        <Link href={CUSTOMER_ACCOUNT_ROUTES.profile} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('profileLink')}
        </Link>
        <Link href={CUSTOMER_ACCOUNT_ROUTES.security} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('securityLink')}
        </Link>
        <Link href={CUSTOMER_ACCOUNT_ROUTES.identity} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('identityLink')}
        </Link>
      </div>
    </ForexPortalModuleCard>
  );
}
