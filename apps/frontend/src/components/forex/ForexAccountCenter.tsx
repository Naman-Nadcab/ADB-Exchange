'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { ForexAccountCenterCard } from '@/components/forex/ForexAccountCenterCard';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexLiveKycPolicy } from '@/lib/forex/hooks/useForexLiveKycPolicy';
import { switchForexActiveAccount, syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';
import { ROUTES } from '@/lib/routes';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export function ForexAccountCenter() {
  const t = useTranslations('forex.accountCenter');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { gates } = useForexProductGates();
  const kycPolicy = useForexLiveKycPolicy();

  function kindLabel(kind: string): string {
    const k = kind.toUpperCase();
    if (k === 'DEMO') return t('kindDemo');
    if (k === 'LIVE' || k === 'REAL') return t('kindLive');
    return kind;
  }

  const reload = useCallback(async () => {
    if (!authed) return;
    await syncForexAccountsFromServer();
  }, [authed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSwitch(accountId: string) {
    if (busy || accountId === activeId) return;
    setBusy(accountId);
    setErr(null);
    setNote(null);
    try {
      const ok = await switchForexActiveAccount(accountId);
      if (!ok) {
        setErr(t('switchFailed'));
        return;
      }
      await reload();
      setNote(t('activeAccount', { accountId }));
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.accounts}`} sectionKey="forexAccounts" />;
  }

  return (
    <div className="space-y-3">
      {!gates.liveAccountEnabled ? (
        <ForexPortalModuleCard title={t('liveUnavailableTitle')} accent>
          <p className="text-sm text-muted-foreground">{t('liveUnavailableBody')}</p>
          {kycPolicy.kycRequired && !kycPolicy.kycVerified && !kycPolicy.loading ? (
            <Link href={ROUTES.dashboard.identity} className="mt-2 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('liveUnavailableKycCta')}
            </Link>
          ) : null}
        </ForexPortalModuleCard>
      ) : null}
      <ForexPortalModuleCard
        title={t('cardsSectionTitle')}
        subtitle={t('cardsSectionSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={FOREX_ROUTES.openDemoAccount}
              className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t('createDemo')}
            </Link>
            <Link
              href={FOREX_ROUTES.openLiveAccount}
              className={
                gates.liveAccountEnabled
                  ? 'inline-flex min-h-9 items-center rounded-md border border-border px-3 text-[13px] font-semibold hover:border-primary/40'
                  : 'inline-flex min-h-9 items-center rounded-md border border-border/60 px-3 text-[13px] font-semibold text-muted-foreground hover:border-primary/30'
              }
              title={gates.liveAccountEnabled ? undefined : t('openLiveUnavailableHint')}
            >
              {t('openLiveAccount')}
            </Link>
          </div>
        }
      >
        {note ? <p className="mb-3 text-sm text-buy">{note}</p> : null}
        {err ? <p className="mb-3 text-sm text-sell">{err}</p> : null}
        {hydratePhase === 'hydrating' && !accounts.length ? (
          <p className="text-sm text-muted-foreground">{t('loadingAccounts')}</p>
        ) : null}
        {!accounts.length && hydratePhase !== 'hydrating' ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-2">
            {accounts.map((a) => (
              <ForexAccountCenterCard
                key={a.accountId}
                account={a}
                isActive={a.accountId === activeId}
                busy={busy}
                kindLabel={kindLabel}
                onSwitch={(id) => void onSwitch(id)}
              />
            ))}
          </div>
        )}
      </ForexPortalModuleCard>

      <p className="text-[11px] text-muted-foreground">
        {t.rich('quickSwitchHint', {
          tradeLink: (chunks) => (
            <Link href={FOREX_ROUTES.trade} className="text-primary underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
