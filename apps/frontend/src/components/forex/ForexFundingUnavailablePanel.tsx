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
  const stepPrefix =
    props.variant === 'paymentMethods' ? 'paymentStep' : props.variant === 'deposit' ? 'depositStep' : props.variant === 'withdraw' ? 'withdrawStep' : 'transferStep';
  const stepCount = props.variant === 'paymentMethods' ? 3 : 4;
  const steps = Array.from({ length: stepCount }, (_, i) => t(`${stepPrefix}${i + 1}` as 'depositStep1'));

  return (
    <ForexPortalModuleCard title={t(titleKey)} subtitle={t('subtitle')}>
      <ForexPortalStatusBadge tone="warning">{t(badgeKey)}</ForexPortalStatusBadge>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t(bodyKey)}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] text-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-muted-foreground">{t('previewLead')}</p>
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
