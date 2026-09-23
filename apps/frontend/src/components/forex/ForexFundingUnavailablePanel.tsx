'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';
import { ROUTES } from '@/lib/routes';

export function ForexFundingUnavailablePanel(props: {
  variant: 'deposit' | 'withdraw' | 'transfer' | 'paymentMethods';
}) {
  const t = useTranslations('forex.fundingGate');
  const titleKey = `${props.variant}Title` as const;
  const bodyKey = `${props.variant}Body` as const;
  const badgeKey = `${props.variant}Badge` as const;

  return (
    <ForexPortalModuleCard title={t(titleKey)} subtitle={t('subtitle')}>
      <ForexPortalStatusBadge tone="warning">{t(badgeKey)}</ForexPortalStatusBadge>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t(bodyKey)}</p>
      <p className="mt-3 text-[12px] text-muted-foreground">
        {t.rich('verificationHint', {
          verifyLink: (chunks) => (
            <Link href={ROUTES.dashboard.identity} className="text-primary underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <details className="mt-4 rounded border border-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">{t('technicalDetailsLabel')}</summary>
        <p className="mt-2 leading-relaxed">{t('technicalDetailsBody')}</p>
      </details>
    </ForexPortalModuleCard>
  );
}
