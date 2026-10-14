'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

export default function ForexPartnerPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.partnerPage');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [introducer, setIntroducer] = useState<{ code: string; label: string } | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = unwrap(await forexApi.getPartnerCabinet());
      if (!res.ok) return;
      setIntroducer(res.data.introducer);
    })();
  }, [authed]);

  return (
    <ForexPageFrame title={tf('pages.partner.title')} subtitle={tf('pages.partner.subtitle')}>
      {!authed ? <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.partner}`} sectionKey="partner" /> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('codeTitle')} accent>
          <ForexPortalStatusBadge tone="warning">{t('notEnabled')}</ForexPortalStatusBadge>
          <p className="mt-3 text-sm text-muted-foreground">{authed ? t('notIbBody') : t('signedOutNote')}</p>
          <p className="mt-3 text-[12px] text-muted-foreground">{t('codeEmpty')}</p>
          <p className="mt-2 text-[12px] text-muted-foreground">{t('linkEmpty')}</p>
          {introducer ? (
            <p className="mt-3 text-sm text-foreground">{t('introducerBody', { code: introducer.code })}</p>
          ) : null}
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('clientsTitle')}>
          <div className="eda-table-wrap overflow-x-auto">
            <table className="eda-table min-w-[420px] text-[12px]">
              <thead>
                <tr>
                  <th>{t('colAccount')}</th>
                  <th>{t('colVolume')}</th>
                  <th>{t('colSince')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="text-muted-foreground">{t('clientsEmpty')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('commissionTitle')}>
          <dl className="grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <dt className="text-muted-foreground">{t('accrued')}</dt>
              <dd className="mt-1 font-mono text-foreground">—</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('paid')}</dt>
              <dd className="mt-1 font-mono text-foreground">—</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('pending')}</dt>
              <dd className="mt-1 font-mono text-foreground">—</dd>
            </div>
          </dl>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('payoutTitle')}>
          <p className="text-sm text-muted-foreground">{t('payoutBody')}</p>
          <button
            type="button"
            disabled
            className="mt-3 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t('requestPayout')}
          </button>
          <p className="mt-2 text-[12px] text-muted-foreground">{t('payoutLocked')}</p>
        </ForexPortalModuleCard>
      </div>
    </ForexPageFrame>
  );
}
