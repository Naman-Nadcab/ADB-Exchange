'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { createForexDemoAccountAndActivate, syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

export default function ForexOpenDemoAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.openDemo');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function onCreate() {
    if (busy || !authed) return;
    setBusy(true);
    setErr(null);
    try {
      const ok = await createForexDemoAccountAndActivate();
      if (!ok) {
        setErr(t('failed'));
        return;
      }
      await syncForexAccountsFromServer();
      setCreated(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForexPageFrame title={tf('pages.openDemo.title')} subtitle={tf('pages.openDemo.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.openDemoAccount}`} sectionKey="forexAccounts" />
      ) : null}
      <ForexPortalModuleCard title={t('flowTitle')} accent>
        <ForexPortalStatusBadge tone="primary">{t('demoBadge')}</ForexPortalStatusBadge>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12px] text-muted-foreground">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
        </ol>
        <p className="mt-3 text-[12px] text-foreground">{t('simulatedNotice')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!authed || busy}
            onClick={() => void onCreate()}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? t('creating') : t('createCta')}
          </button>
          <Link href={FOREX_ROUTES.accounts} className="rounded border border-border px-4 py-2 text-[12px] font-semibold">
            {t('backAccounts')}
          </Link>
        </div>
        {created ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-buy">{t('success')}</p>
            <div className="flex flex-wrap gap-3 text-[12px]">
              <Link href={FOREX_ROUTES.funds} className="font-semibold text-primary underline-offset-2 hover:underline">
                {t('goFunds')}
              </Link>
              <Link href={FOREX_ROUTES.trade} className="font-semibold text-primary underline-offset-2 hover:underline">
                {t('goTerminal')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
            <Link href={FOREX_ROUTES.funds} className="font-semibold text-primary underline-offset-2 hover:underline">
              {t('goFunds')}
            </Link>
            <Link href={FOREX_ROUTES.trade} className="font-semibold text-primary underline-offset-2 hover:underline">
              {t('goTerminal')}
            </Link>
          </div>
        )}
        {err ? <p className="mt-3 text-sm text-sell">{err}</p> : null}
      </ForexPortalModuleCard>
    </ForexPageFrame>
  );
}
