'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Wallet } from 'lucide-react';
import { ForexSignInPrompt } from './ForexPageFrame';
import { fxPlain } from './format';
import {
  ForexPortalKpiCard,
  ForexPortalModuleCard,
  ForexPortalStatusBadge,
} from './ForexPortalKpiCard';
import { forexApi, unwrap, type ForexCustomerAccountSummary } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { hydrateForexPrivate, switchForexActiveAccount, syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';

export function ForexAccountDetailView({ accountId }: { accountId: string }) {
  const t = useTranslations('forex.accountDetail');
  const tu = useTranslations('forex.riskStates');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const accountView = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const risk = useForexStore((s) => s.riskStatus);
  const { gates } = useForexProductGates();

  const [meta, setMeta] = useState<ForexCustomerAccountSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isActive = activeId === accountId;

  const loadMeta = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setLoadError(null);
    await syncForexAccountsFromServer();
    const res = unwrap(await forexApi.getAccountById(accountId));
    if (!res.ok) {
      setLoadError(res.error.message);
      setMeta(null);
    } else {
      setMeta(res.data.account);
    }
    setLoading(false);
  }, [accountId, authed]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (isActive && authed) void hydrateForexPrivate();
  }, [isActive, authed, accountId]);

  async function onSwitchHere() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await switchForexActiveAccount(accountId);
      if (!ok) setLoadError(t('switchFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.accountDetail(accountId)}`} sectionKey="forexAccounts" />
    );
  }

  if (loading && !meta) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (loadError && !meta) {
    return (
      <ForexPortalModuleCard title={t('notFoundTitle')}>
        <p className="text-sm text-sell">{loadError}</p>
        <Link href={FOREX_ROUTES.accounts} className="mt-3 inline-block text-[12px] text-primary underline">
          {t('backToAccounts')}
        </Link>
      </ForexPortalModuleCard>
    );
  }

  const m = meta!;
  const kindUpper = m.accountKind.toUpperCase();
  const kindLabel =
    kindUpper === 'DEMO' ? t('kindDemo') : kindUpper === 'LIVE' || kindUpper === 'REAL' ? t('kindLive') : fxPlain(m.accountKind);
  const currency = m.currency ?? accountView?.currency ?? balance?.currency ?? 'USD';
  const lev = m.leverageOverride ? String(m.leverageOverride) : t('leverageDefault');

  return (
    <div className="space-y-3">
      {!isActive ? (
        <ForexPortalModuleCard title={t('inactiveTitle')} accent>
          <p className="text-sm text-muted-foreground">{t('inactiveBody')}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSwitchHere()}
            className="mt-3 rounded border border-primary/45 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:opacity-50"
          >
            {busy ? t('switching') : t('switchToAccount')}
          </button>
        </ForexPortalModuleCard>
      ) : null}

      <section
        className="eda-card border-primary/25 bg-gradient-to-r from-card via-card to-primary/[0.05] p-3 sm:p-4"
        aria-label={t('heroAria')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ForexPortalStatusBadge tone={kindUpper === 'DEMO' ? 'primary' : 'neutral'}>{kindLabel}</ForexPortalStatusBadge>
              <ForexPortalStatusBadge tone={String(m.status).toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}>
                {fxPlain(m.status)}
              </ForexPortalStatusBadge>
            </div>
            <h2 className="mt-2 font-mono text-lg font-semibold tracking-tight">{fxPlain(m.accountId)}</h2>
            <p className="text-[11px] text-muted-foreground">
              {fxPlain(m.currency)} · {fxPlain(m.positionMode)} · {t('leverageLabel', { value: lev })}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t('createdAt', { date: new Date(m.createdAt).toLocaleString() })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex items-center gap-1 rounded border border-primary/45 bg-primary/12 px-3 py-2 text-[11px] font-semibold text-primary"
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              {t('openTerminal')}
            </Link>
            {kindUpper === 'DEMO' ? (
              <Link
                href={FOREX_ROUTES.funds}
                className="inline-flex items-center gap-1 rounded border border-border px-3 py-2 text-[11px] font-semibold"
              >
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {t('demoFundingCta')}
              </Link>
            ) : gates.realFundingEnabled ? (
              <Link href={FOREX_ROUTES.fundsDeposit} className="inline-flex items-center rounded border border-border px-3 py-2 text-[11px] font-semibold">
                {t('depositCta')}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <ForexPortalModuleCard title={t('identityTitle')}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 font-mono text-[12px]">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldAccountId')}</dt>
            <dd className="mt-0.5">{fxPlain(m.accountId)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldKind')}</dt>
            <dd className="mt-0.5">{kindLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldCurrency')}</dt>
            <dd className="mt-0.5">{fxPlain(m.currency)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldPositionMode')}</dt>
            <dd className="mt-0.5">{fxPlain(m.positionMode)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldLeverage')}</dt>
            <dd className="mt-0.5">{lev}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldPlatform')}</dt>
            <dd className="mt-0.5">{t('platformValue')}</dd>
          </div>
        </dl>
        <details className="mt-3 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer text-foreground">{t('technicalDetailsLabel')}</summary>
          <p className="mt-2">{t('technicalDetailsBody')}</p>
        </details>
      </ForexPortalModuleCard>

      {isActive ? (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label={t('financialAria')}>
            <ForexPortalKpiCard emphasis="primary" label={t('metricBalance')} value={accountView?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" label={t('metricEquity')} value={accountView?.equity ?? balance?.equity} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" label={t('metricFreeMargin')} value={accountView?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexPortalKpiCard emphasis="secondary" label={t('metricUsedMargin')} value={accountView?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexPortalKpiCard emphasis="secondary" label={t('metricUnrealizedPnl')} value={accountView?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
            <ForexPortalKpiCard emphasis="secondary" label={t('metricRealizedPnl')} value={accountView?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexPortalKpiCard emphasis="secondary" label={t('metricMarginLevel')} value={accountView?.marginLevel ?? margin?.marginLevel} kind="plain" />
            <ForexPortalKpiCard emphasis="secondary" label={t('metricAvailable')} value={accountView?.availableBalance ?? balance?.availableBalance} currency={currency} />
          </section>

          <ForexPortalModuleCard title={t('healthTitle')} accent>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">{t('riskState')}</dt>
                <dd className="mt-0.5">{fxPlain(risk?.state) || tu('unavailable')}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">{t('riskReason')}</dt>
                <dd className="mt-0.5">{fxPlain(risk?.reason)}</dd>
              </div>
            </dl>
          </ForexPortalModuleCard>

          <ForexPortalModuleCard title={t('activityTitle')}>
            <div className="flex flex-wrap gap-2">
              <Link href={FOREX_ROUTES.portfolio} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                {t('linkPositions')}
              </Link>
              <Link href={FOREX_ROUTES.orders} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                {t('linkOrders')}
              </Link>
              <Link href={FOREX_ROUTES.history} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                {t('linkHistory')}
              </Link>
              <Link href={FOREX_ROUTES.ledger} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                {t('linkLedger')}
              </Link>
            </div>
          </ForexPortalModuleCard>
        </>
      ) : (
        <ForexPortalModuleCard title={t('financialLockedTitle')}>
          <p className="text-sm text-muted-foreground">{t('financialLockedBody')}</p>
        </ForexPortalModuleCard>
      )}

      <ForexPortalModuleCard title={t('accessTitle')}>
        <p className="text-sm text-muted-foreground">{t('accessBody')}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">{t('passwordNeverShown')}</p>
      </ForexPortalModuleCard>
    </div>
  );
}
