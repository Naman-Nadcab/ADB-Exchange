'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [partner, setPartner] = useState<{ code: string; label: string; commissionPerLot: string } | null>(null);
  const [clients, setClients] = useState<Array<{ accountId: string | null; volumeLots: string; since: string }>>([]);
  const [commission, setCommission] = useState<{ accrued: string; paid: string; pending: string } | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = unwrap(await forexApi.getPartnerCabinet());
      if (!res.ok) return;
      setIntroducer(res.data.introducer);
      setPartner(res.data.partner);
      setClients(res.data.clients ?? []);
      setCommission(res.data.commission ?? null);
    })();
  }, [authed]);

  const referralLink = partner && typeof window !== 'undefined'
    ? `${window.location.origin}${FOREX_ROUTES.openLiveAccount}?code=${encodeURIComponent(partner.code)}`
    : '';

  return (
    <ForexPageFrame title={tf('pages.partner.title')} subtitle={tf('pages.partner.subtitle')}>
      {!authed ? <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.partner}`} sectionKey="partner" /> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('traderTitle')} accent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {introducer ? t('introducerBody', { code: introducer.code }) : t('traderBody')}
          </p>
          {introducer?.label ? <p className="mt-2 text-[12px] text-foreground">{introducer.label}</p> : null}
          <Link href={FOREX_ROUTES.openLiveAccount} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
            {t('traderCta')}
          </Link>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('ibTitle')}>
          <ForexPortalStatusBadge tone={partner ? 'success' : 'warning'}>{partner ? t('assigned') : t('notAssigned')}</ForexPortalStatusBadge>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{partner ? t('assignedBody', { code: partner.code }) : t('ibBody')}</p>
        </ForexPortalModuleCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('codeTitle')}>
          {partner ? (
            <>
              <p className="font-mono text-sm text-foreground">{partner.code}</p>
              <p className="mt-2 text-[12px] text-muted-foreground">{partner.label}</p>
              {referralLink ? <p className="mt-2 break-all text-[12px] text-foreground">{referralLink}</p> : null}
            </>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground">{t('codeEmpty')}</p>
              <p className="mt-2 text-[12px] text-muted-foreground">{t('linkEmpty')}</p>
            </>
          )}
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
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-muted-foreground">{t('clientsEmpty')}</td>
                  </tr>
                ) : clients.map((client) => (
                  <tr key={`${client.accountId ?? 'none'}-${client.since}`}>
                    <td className="font-mono">{client.accountId ?? '—'}</td>
                    <td className="font-mono">{client.volumeLots}</td>
                    <td>{client.since.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('commissionTitle')}>
          {commission ? null : <p className="mb-3 text-[12px] text-muted-foreground">{t('commissionEmpty')}</p>}
          <dl className="grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <dt className="text-muted-foreground">{t('accrued')}</dt>
              <dd className="mt-1 font-mono text-foreground">{commission?.accrued ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('paid')}</dt>
              <dd className="mt-1 font-mono text-foreground">{commission?.paid ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('pending')}</dt>
              <dd className="mt-1 font-mono text-foreground">{commission?.pending ?? '—'}</dd>
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
