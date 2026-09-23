'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KeyRound, Lock, Shield } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';

/** Platform + gated trading credential guidance — never shows secrets. */
export function ForexTradingCredentialPanel() {
  const t = useTranslations('forex.credentials');

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <div className="space-y-3">
        <div className="rounded border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-[12px] font-medium">{t('platformLoginTitle')}</p>
            </div>
            <Link href={ROUTES.dashboard.security} className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('changePlatformPassword')}
            </Link>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('platformLoginBody')}</p>
        </div>
        <div className="rounded border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="text-[12px] font-medium">{t('tradingPasswordTitle')}</p>
            </div>
            <ForexPortalStatusBadge tone="warning">{t('unavailableBadge')}</ForexPortalStatusBadge>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('tradingPasswordBody')}</p>
        </div>
        <div className="rounded border border-border/50 bg-muted/5 p-3 opacity-90">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-[12px] font-medium text-muted-foreground">{t('investorPasswordTitle')}</p>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('investorPasswordBody')}</p>
        </div>
      </div>
    </ForexPortalModuleCard>
  );
}
