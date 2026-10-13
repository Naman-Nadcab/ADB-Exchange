'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexEnumLabel, forexServerCopy } from '@/components/forex/forex-enum-label';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

export default function ForexOpenLiveAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.openLive');
  const te = useTranslations('forex.enums');
  const ts = useTranslations('forex.serverCopy');
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
  const [applications, setApplications] = useState<Array<{ applicationId: string; status: string; createdAt?: string; failureReason?: string | null }>>([]);
  const [err, setErr] = useState<string | null>(null);

  function copy(value: string | null | undefined): string {
    return forexServerCopy(ts, value);
  }

  async function loadApplications() {
    const listed = unwrap(await forexApi.listLiveApplications());
    if (!listed.ok) return;
    setApplications(
      listed.data.applications.map((row) => ({
        applicationId: String(row.applicationId ?? ''),
        status: String(row.status ?? ''),
        createdAt: row.createdAt == null ? undefined : String(row.createdAt),
        failureReason: row.failureReason == null ? null : String(row.failureReason),
      })),
    );
  }

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
      await loadApplications();
    })();
  }, [authed]);

  const kycRequired = !authed || eligibility?.kycRequired !== false;
  const kycVerified = authed && eligibility?.kycVerified === true;
  const canApply = authed && eligibility != null && eligibility.applicationAccepted !== false && (!eligibility.kycRequired || eligibility.kycVerified);
  const available = authed && eligibility?.available === true;

  async function onApply() {
    if (busy || !canApply) return;
    setBusy(true);
    setErr(null);
    setAppStatus(null);
    const idempotencyKey = `live-app:${Date.now()}`;
    const res = unwrap(await forexApi.submitLiveApplication({ idempotencyKey, positionMode: 'NETTING' }));
    setBusy(false);
    if (!res.ok) {
      setErr(copy(res.error.message) || res.error.message);
      return;
    }
    const status = String((res.data.application as { status?: string }).status ?? 'PENDING');
    setAppStatus(status);
    await loadApplications();
  }

  return (
    <ForexPageFrame title={tf('pages.openLive.title')} subtitle={tf('pages.openLive.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.openLiveAccount}`} sectionKey="forexAccounts" />
      ) : null}
      <ForexPortalModuleCard title={t('eligibilityTitle')} accent>
        <ForexPortalStatusBadge tone={available ? 'success' : 'warning'}>
          {available ? t('availableBadge') : t('unavailableBadge')}
        </ForexPortalStatusBadge>
        <p className="mt-3 text-sm text-muted-foreground">
          {!authed ? t('signedOutNote') : eligibility ? copy(eligibility.message) : t('loadingEligibility')}
        </p>
        {!available ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t('reasonLabel')}: {eligibility ? copy(eligibility.reason) : copy('PROVIDER_OR_RAIL_BLOCKED')}
          </p>
        ) : null}
        {eligibility?.blockers?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {eligibility.blockers.map((b) => (
              <li key={b}>{copy(b)}</li>
            ))}
          </ul>
        ) : null}
      </ForexPortalModuleCard>
      <ForexPortalModuleCard title={t('checklistTitle')}>
        <ul className="space-y-2 text-[12px]">
          <li>{!kycRequired ? t('kycOptional') : kycVerified ? t('kycDone') : t('kycPending')}</li>
          <li>{available ? t('providerReady') : t('providerPending')}</li>
          <li>{available ? t('provisioningReady') : t('provisioningPending')}</li>
        </ul>
        {kycRequired && !kycVerified ? (
          <Link href={ROUTES.dashboard.identity} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
            {t('kycCta')}
          </Link>
        ) : null}
      </ForexPortalModuleCard>
      <ForexPortalModuleCard title={t('applicationTitle')}>
        <p className="text-sm text-muted-foreground">{t('applicationBody')}</p>
        <button
          type="button"
          disabled={!canApply || busy}
          onClick={() => void onApply()}
          className="mt-3 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? t('applicationSubmitting') : t('applicationSubmit')}
        </button>
        {!canApply ? <p className="mt-2 text-[12px] text-muted-foreground">{t('submitLocked')}</p> : null}
        {appStatus ? (
          <p className="mt-2 text-sm text-buy">{t('applicationStatus', { status: forexEnumLabel(te, appStatus) })}</p>
        ) : null}
        {err ? <p className="mt-2 text-sm text-sell">{err}</p> : null}
        <div className="mt-4 border-t border-border/70 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('applicationsTitle')}</p>
          {applications.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">{t('applicationsEmpty')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px]">
              {applications.map((row) => (
                <li key={row.applicationId}>
                  {forexEnumLabel(te, row.status)}
                  {row.failureReason ? ` · ${copy(row.failureReason)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href={FOREX_ROUTES.accounts} className="mt-3 inline-block text-[12px] text-primary underline-offset-2 hover:underline">
          {t('backAccounts')}
        </Link>
      </ForexPortalModuleCard>
    </ForexPageFrame>
  );
}
