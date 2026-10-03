'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

export default function ForexOpenLiveAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.openLive');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [eligibility, setEligibility] = useState<{
    available: boolean;
    applicationAccepted?: boolean;
    kycRequired: boolean;
    kycVerified: boolean;
    message: string;
    reason: string;
    blockers?: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = unwrap(await forexApi.getLiveOpeningEligibility());
      if (res.ok) {
        setEligibility({
          available: res.data.liveAccountOpeningAvailable,
          applicationAccepted: res.data.applicationAccepted,
          kycRequired: res.data.kycRequired !== false,
          kycVerified: res.data.kycVerified === true,
          message: res.data.message,
          reason: res.data.reason,
          blockers: res.data.blockers,
        });
      }
    })();
  }, [authed]);

  async function onApply() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setAppStatus(null);
    const idempotencyKey = `live-app:${Date.now()}`;
    const res = unwrap(await forexApi.submitLiveApplication({ idempotencyKey, positionMode: 'NETTING' }));
    setBusy(false);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    const status = String((res.data.application as { status?: string }).status ?? 'PENDING');
    setAppStatus(status);
  }

  const kycRequired = eligibility?.kycRequired !== false;
  const kycVerified = eligibility?.kycVerified === true;
  const canApply = eligibility != null && eligibility.applicationAccepted !== false && (!kycRequired || kycVerified);

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
            {eligibility?.blockers?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                {eligibility.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </ForexPortalModuleCard>
          <ForexPortalModuleCard title={t('checklistTitle')}>
            <ul className="space-y-2 text-[12px]">
              <li>{!kycRequired ? t('kycOptional') : kycVerified ? t('kycDone') : t('kycPending')}</li>
              <li>{t('providerPending')}</li>
              <li>{t('provisioningPending')}</li>
            </ul>
            {kycRequired && !kycVerified ? (
              <Link href={ROUTES.dashboard.identity} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
                {t('kycCta')}
              </Link>
            ) : null}
          </ForexPortalModuleCard>
          <ForexPortalModuleCard title={t('applicationTitle')}>
            <p className="text-sm text-muted-foreground">{t('applicationBody')}</p>
            {canApply ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onApply()}
                className="mt-3 inline-flex min-h-10 items-center rounded border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary disabled:opacity-50"
              >
                {busy ? t('applicationSubmitting') : t('applicationSubmit')}
              </button>
            ) : null}
            {appStatus ? (
              <p className="mt-2 text-sm text-buy">{t('applicationStatus', { status: appStatus })}</p>
            ) : null}
            {err ? <p className="mt-2 text-sm text-sell">{err}</p> : null}
            <Link href={FOREX_ROUTES.accounts} className="mt-3 inline-block text-[12px] text-primary underline-offset-2 hover:underline">
              {t('backAccounts')}
            </Link>
          </ForexPortalModuleCard>
        </>
      )}
    </ForexPageFrame>
  );
}
