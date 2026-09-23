'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexWalletKyc } from '@/lib/forex/hooks/useForexWalletKyc';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

export default function ForexOpenLiveAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.openLive');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const kyc = useForexWalletKyc();
  const [eligibility, setEligibility] = useState<{ available: boolean; message: string; reason: string } | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = unwrap(await forexApi.getLiveOpeningEligibility());
      if (res.ok) {
        setEligibility({
          available: res.data.liveAccountOpeningAvailable,
          message: res.data.message,
          reason: res.data.reason,
        });
      }
    })();
  }, [authed]);

  return (
    <ForexPageFrame title={tf('pages.openLive.title')} subtitle={tf('pages.openLive.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.openLiveAccount}`} sectionKey="forexAccounts" />
      ) : (
        <>
          <ForexPortalModuleCard title={t('eligibilityTitle')} accent>
            <ForexPortalStatusBadge tone={eligibility?.available ? 'success' : 'warning'}>
              {eligibility?.available ? t('availableBadge') : t('unavailableBadge')}
            </ForexPortalStatusBadge>
            <p className="mt-3 text-sm text-muted-foreground">{eligibility?.message ?? t('loadingEligibility')}</p>
            {!eligibility?.available ? (
              <p className="mt-2 text-[11px] text-muted-foreground">{t('reasonLabel')}: {eligibility?.reason ?? '—'}</p>
            ) : null}
          </ForexPortalModuleCard>
          <ForexPortalModuleCard title={t('checklistTitle')}>
            <ul className="space-y-2 text-[12px]">
              <li>{kyc.verified ? t('kycDone') : t('kycPending')}</li>
              <li>{t('providerPending')}</li>
              <li>{t('provisioningPending')}</li>
            </ul>
            {!kyc.verified ? (
              <Link href={ROUTES.dashboard.identity} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
                {t('kycCta')}
              </Link>
            ) : null}
          </ForexPortalModuleCard>
          <ForexPortalModuleCard title={t('applicationTitle')}>
            <p className="text-sm text-muted-foreground">{t('applicationBody')}</p>
            <Link href={FOREX_ROUTES.accounts} className="mt-3 inline-block text-[12px] text-primary underline-offset-2 hover:underline">
              {t('backAccounts')}
            </Link>
          </ForexPortalModuleCard>
        </>
      )}
    </ForexPageFrame>
  );
}
