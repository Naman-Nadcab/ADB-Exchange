'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, CircleDollarSign, Gauge, LayoutGrid, Wallet } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { ForexAccountSettingsPanel } from './ForexAccountSettingsPanel';
import { ForexTradingCredentialPanel } from './ForexTradingCredentialPanel';
import { ForexSignInPrompt } from './ForexPageFrame';
import { fxNum, fxPlain } from './format';
import {
  ForexPortalKpiCard,
  ForexPortalModuleCard,
  ForexPortalStatusBadge,
} from './ForexPortalKpiCard';
import { forexApi, unwrap, type ForexAccountHubPayload } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_PRODUCT } from '@/lib/forex/brand';
import { useForexWalletKyc } from '@/lib/forex/hooks/useForexWalletKyc';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { hydrateForexPrivate, switchForexActiveAccount, syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

export function ForexAccountManagementHub({ accountId }: { accountId: string }) {
  const t = useTranslations('forex.accountHub');
  const td = useTranslations('forex.accountDetail');
  const tu = useTranslations('forex.riskStates');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const storeFees = useForexStore((s) => s.fees);
  const storeSwaps = useForexStore((s) => s.swaps);
  const { gates } = useForexProductGates();
  const kyc = useForexWalletKyc();

  const [hub, setHub] = useState<ForexAccountHubPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setLoadError(null);
    await syncForexAccountsFromServer();
    const res = unwrap(await forexApi.getAccountById(accountId));
    if (!res.ok) {
      setLoadError(res.error.message);
      setHub(null);
    } else {
      setHub(res.data);
      if (res.data.isSelected) await hydrateForexPrivate();
    }
    setLoading(false);
  }, [accountId, authed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const unavailable = tu('unavailable');

  const m = hub?.account;
  const fin = hub?.financialSnapshot;
  const currency = fin?.currency ?? m?.currency ?? 'USD';
  const kindUpper = String(m?.accountKind ?? '').toUpperCase();
  const isDemo = kindUpper === 'DEMO';
  const kindLabel = isDemo ? td('kindDemo') : kindUpper === 'LIVE' || kindUpper === 'REAL' ? td('kindLive') : fxPlain(m?.accountKind);
  const lev = m?.leverageOverride ? String(m.leverageOverride) : td('leverageDefault');

  const readiness = useMemo(() => {
    const items: Array<{ key: string; done: boolean; label: string }> = [];
    items.push({
      key: 'identity',
      done: kyc.verified,
      label: kyc.verified ? t('readinessIdentityDone') : t('readinessIdentityPending'),
    });
    items.push({
      key: 'account',
      done: Boolean(m?.accountId),
      label: t('readinessAccountReady'),
    });
    if (gates.liveAccountEnabled) {
      items.push({
        key: 'live',
        done: !isDemo && kyc.verified,
        label: t('readinessLiveEligible'),
      });
      items.push({
        key: 'funding',
        done: gates.realFundingEnabled,
        label: gates.realFundingEnabled ? t('readinessFundingOn') : t('readinessFundingOff'),
      });
    } else {
      items.push({ key: 'live-off', done: false, label: t('readinessLiveOff') });
    }
    return items;
  }, [gates.liveAccountEnabled, gates.realFundingEnabled, isDemo, kyc.verified, m?.accountId, t]);

  async function onSwitchHere() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await switchForexActiveAccount(accountId);
      if (!ok) setLoadError(td('switchFailed'));
      else await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.accountDetail(accountId)}`} sectionKey="forexAccounts" />
    );
  }

  if (loading && !hub) {
    return <p className="text-sm text-muted-foreground">{td('loading')}</p>;
  }

  if (loadError && !hub) {
    return (
      <ForexPortalModuleCard title={td('notFoundTitle')}>
        <p className="text-sm text-sell">{loadError}</p>
        <Link href={FOREX_ROUTES.accounts} className="mt-3 inline-block text-[12px] text-primary underline">
          {td('backToAccounts')}
        </Link>
      </ForexPortalModuleCard>
    );
  }

  if (!hub || !m) return null;

  const selected = hub.isSelected;
  const statusUpper = String(m.status).toUpperCase();
  const feesTotal = selected ? storeFees?.total : undefined;
  const swapsTotal = selected ? storeSwaps?.total : undefined;

  return (
    <div className="space-y-3">
      {/* Hero */}
      <section
        className="eda-card border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.07] p-4 sm:p-5"
        aria-label={t('heroAria')}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/90">{t('tradingAccountLabel')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <ForexPortalStatusBadge tone={isDemo ? 'primary' : 'neutral'}>{kindLabel}</ForexPortalStatusBadge>
              <ForexPortalStatusBadge tone={statusUpper === 'ACTIVE' ? 'success' : 'warning'}>{fxPlain(m.status)}</ForexPortalStatusBadge>
              {selected ? (
                <ForexPortalStatusBadge tone="success">{t('selectedBadge')}</ForexPortalStatusBadge>
              ) : (
                <ForexPortalStatusBadge tone="neutral">{t('notSelectedBadge')}</ForexPortalStatusBadge>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{fxPlain(m.label ?? `${m.accountKind} · ${m.currency}`)}</h2>
            <p className="font-mono text-[12px] text-muted-foreground">
              {t('tradingLoginLabel')}: {fxPlain(m.tradingLogin ?? m.accountId)}
            </p>
            {m.platformCustomerId ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {t('platformCustomerIdLabel')}: {fxPlain(m.platformCustomerId)}
              </p>
            ) : null}
            {m.brokerTradingLogin ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {t('brokerLoginLabel')}: {fxPlain(m.brokerTradingLogin)}
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {t('serverLabel')}: {m.server ? fxPlain(m.server) : t('serverSimulated')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fxPlain(m.currency)} · {td('createdAt', { date: new Date(m.createdAt).toLocaleString() })}
            </p>
            {isDemo ? (
              <p className="text-[11px] font-medium text-primary/90">{t('demoFundsNotice')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end">
            {!selected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSwitchHere()}
                className="inline-flex min-h-10 items-center justify-center rounded border border-primary/45 bg-primary/12 px-4 text-[12px] font-semibold text-primary disabled:opacity-50"
              >
                {busy ? td('switching') : t('actionSwitch')}
              </button>
            ) : null}
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-primary/45 bg-primary/12 px-4 text-[12px] font-semibold text-primary"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              {t('actionTerminal')}
            </Link>
            <a
              href="#account-funding"
              className="inline-flex min-h-10 items-center justify-center rounded border border-border px-4 text-[12px] font-semibold hover:border-primary/35"
            >
              {t('actionManage')}
            </a>
            {isDemo ? (
              <Link
                href={FOREX_ROUTES.funds}
                className="inline-flex min-h-10 items-center justify-center rounded border border-border px-4 text-[12px] font-semibold hover:border-primary/35"
              >
                {t('demoFundingCta')}
              </Link>
            ) : null}
            {gates.realFundingEnabled ? (
              <>
                <Link href={FOREX_ROUTES.fundsDeposit} className="inline-flex min-h-10 items-center justify-center rounded border border-border px-4 text-[12px] font-semibold">
                  {t('depositCta')}
                </Link>
                <Link href={FOREX_ROUTES.fundsWithdraw} className="inline-flex min-h-10 items-center justify-center rounded border border-border px-4 text-[12px] font-semibold">
                  {t('withdrawCta')}
                </Link>
                <Link href={FOREX_ROUTES.fundsTransfer} className="inline-flex min-h-10 items-center justify-center rounded border border-border px-4 text-[12px] font-semibold">
                  {t('transferCta')}
                </Link>
              </>
            ) : (
              <>
                <span className="inline-flex min-h-10 cursor-not-allowed items-center rounded border border-border/50 px-4 text-[12px] text-muted-foreground" title={t('realFundingOffHint')}>
                  {t('depositCta')}
                </span>
                <span className="inline-flex min-h-10 cursor-not-allowed items-center rounded border border-border/50 px-4 text-[12px] text-muted-foreground" title={t('realFundingOffHint')}>
                  {t('withdrawCta')}
                </span>
                <span className="inline-flex min-h-10 cursor-not-allowed items-center rounded border border-border/50 px-4 text-[12px] text-muted-foreground" title={t('realFundingOffHint')}>
                  {t('transferCta')}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Readiness */}
      <ForexPortalModuleCard title={t('readinessTitle')} subtitle={t('readinessSubtitle')} accent>
        <ul className="space-y-2">
          {readiness.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-[12px]">
              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', item.done ? 'bg-buy/20 text-buy' : 'bg-muted text-muted-foreground')}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </li>
          ))}
        </ul>
        {!kyc.verified && !kyc.loading ? (
          <Link href={ROUTES.dashboard.identity} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
            {t('readinessKycCta')}
          </Link>
        ) : null}
      </ForexPortalModuleCard>

      {/* Financial snapshot */}
      <section aria-label={t('financialTitle')}>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('financialTitle')}</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <ForexPortalKpiCard emphasis="primary" icon={Wallet} label={t('metricBalance')} value={fin?.ledgerBalance} currency={currency} />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricCredit')} value={undefined} kind="plain" hint={t('metricUnavailable')} />
          <ForexPortalKpiCard emphasis="primary" icon={CircleDollarSign} label={t('metricEquity')} value={fin?.equity} currency={currency} />
          <ForexPortalKpiCard emphasis="primary" icon={Gauge} label={t('metricFreeMargin')} value={fin?.freeMargin} currency={currency} />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricUsedMargin')} value={fin?.usedMargin} currency={currency} />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricMarginLevel')} value={fin?.marginLevel ?? undefined} kind="plain" hint={fin?.marginLevel == null ? t('metricUnavailable') : '%'} />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricUnrealizedPnl')} value={fin?.unrealizedPnl} currency={currency} signed />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricRealizedPnl')} value={fin?.realizedPnl} currency={currency} signed />
          <ForexPortalKpiCard emphasis="secondary" label={t('metricAvailable')} value={fin?.availableBalance} currency={currency} />
          {feesTotal != null ? (
            <ForexPortalKpiCard emphasis="secondary" label={t('metricFees')} value={feesTotal} currency={storeFees?.currency ?? currency} />
          ) : null}
          {swapsTotal != null ? (
            <ForexPortalKpiCard emphasis="secondary" icon={ArrowLeftRight} label={t('metricSwaps')} value={swapsTotal} currency={storeSwaps?.currency ?? currency} />
          ) : null}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {t('calculationLabel')}: {fxPlain(fin?.calculationStatus) || unavailable}
          {isDemo ? ` · ${t('demoSimulatedHint')}` : ''}
        </p>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Configuration */}
        <ForexPortalModuleCard title={t('configTitle')}>
          <dl className="grid gap-2.5 sm:grid-cols-2 text-[12px]">
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">{t('tradingLoginLabel')}</dt>
              <dd className="mt-0.5 font-mono">{fxPlain(m.accountId)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">{t('serverLabel')}</dt>
              <dd className="mt-0.5">{t('serverSimulated')}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldAccountType')}</dt>
              <dd className="mt-0.5 font-medium">{kindLabel}</dd>
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
              <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldAccountGroup')}</dt>
              <dd className="mt-0.5">{m.groupLabel ? fxPlain(m.groupLabel) : t('groupDefault')}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldPlatform')}</dt>
              <dd className="mt-0.5">{FOREX_PRODUCT.productName}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldEnvironment')}</dt>
              <dd className="mt-0.5">{isDemo ? t('envDemo') : t('envLive')}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-muted-foreground">{t('fieldUpdated')}</dt>
              <dd className="mt-0.5 text-muted-foreground">{new Date(m.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
          <details className="mt-3 rounded border border-border/70 bg-muted/10 px-3 py-2 text-[11px]">
            <summary className="cursor-pointer font-medium text-foreground">{t('technicalDetailsSummary')}</summary>
            <dl className="mt-2 grid gap-1 font-mono text-muted-foreground">
              <div>
                <dt className="inline">{t('fieldInternalId')}: </dt>
                <dd className="inline">{fxPlain(m.accountId)}</dd>
              </div>
              <div>
                <dt className="inline">{t('fieldExecution')}: </dt>
                <dd className="inline">{hub.executionMode}</dd>
              </div>
            </dl>
          </details>
        </ForexPortalModuleCard>

        {/* Risk / health */}
        <ForexPortalModuleCard title={t('healthTitle')} accent>
          <div className="grid grid-cols-2 gap-3 font-mono text-[12px]">
            <div className="rounded border border-border/70 bg-muted/10 p-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{t('metricMarginLevel')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fin?.marginLevel != null ? `${fin.marginLevel}%` : unavailable}</p>
            </div>
            <div className="rounded border border-border/70 bg-muted/10 p-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{t('openPositionsShort')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{hub.activitySummary.openPositions}</p>
            </div>
            <div className="rounded border border-border/70 bg-muted/10 p-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{t('pendingOrdersShort')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{hub.activitySummary.pendingOrders}</p>
            </div>
            <div className="rounded border border-border/70 bg-muted/10 p-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{t('riskStateShort')}</p>
              <p className="mt-1 text-[12px] font-semibold">{fxPlain(hub.riskSnapshot.state) || unavailable}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t('riskReasonLabel')}: {fxPlain(hub.riskSnapshot.reason) || unavailable}
          </p>
        </ForexPortalModuleCard>
      </div>

      <ForexAccountSettingsPanel
        isSelected={selected}
        accountId={accountId}
        positionMode={m.positionMode}
        leverageLabel={lev}
        groupLabel={m.groupLabel}
        groupCode={m.groupCode}
        onChanged={() => void reload()}
      />

      <ForexTradingCredentialPanel accountId={accountId} />

      {/* Funding */}
      <ForexPortalModuleCard id="account-funding" title={t('fundingTitle')} subtitle={t('fundingSubtitle')}>
        <div className="flex flex-wrap gap-2">
          {isDemo ? (
            <Link href={FOREX_ROUTES.funds} className="inline-flex min-h-9 items-center rounded border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary">
              {t('demoFundingCta')}
            </Link>
          ) : null}
          {gates.realFundingEnabled ? (
            <>
              <Link href={FOREX_ROUTES.fundsDeposit} className="inline-flex min-h-9 items-center rounded border border-border px-3 text-[11px] font-semibold">
                {t('depositCta')}
              </Link>
              <Link href={FOREX_ROUTES.fundsWithdraw} className="inline-flex min-h-9 items-center rounded border border-border px-3 text-[11px] font-semibold">
                {t('withdrawCta')}
              </Link>
              <Link href={FOREX_ROUTES.fundsTransfer} className="inline-flex min-h-9 items-center rounded border border-border px-3 text-[11px] font-semibold">
                {t('transferCta')}
              </Link>
            </>
          ) : (
            <>
              <span className="inline-flex min-h-9 cursor-not-allowed items-center rounded border border-border/50 px-3 text-[11px] text-muted-foreground" title={t('realFundingOffHint')}>
                {t('depositCta')}
              </span>
              <span className="inline-flex min-h-9 cursor-not-allowed items-center rounded border border-border/50 px-3 text-[11px] text-muted-foreground" title={t('realFundingOffHint')}>
                {t('withdrawCta')}
              </span>
              <span className="inline-flex min-h-9 cursor-not-allowed items-center rounded border border-border/50 px-3 text-[11px] text-muted-foreground" title={t('realFundingOffHint')}>
                {t('transferCta')}
              </span>
            </>
          )}
          <Link href={FOREX_ROUTES.fundsPaymentMethods} className="inline-flex min-h-9 items-center rounded border border-border/70 px-3 text-[11px] text-muted-foreground hover:text-foreground">
            {t('paymentMethodsCta')}
          </Link>
          <Link href={FOREX_ROUTES.fundsHistory} className="inline-flex min-h-9 items-center rounded border border-border/70 px-3 text-[11px] text-muted-foreground hover:text-foreground">
            {t('fundingHistoryCta')}
          </Link>
        </div>
        {!gates.realFundingEnabled ? <p className="mt-2 text-[11px] text-muted-foreground">{t('realFundingOffBody')}</p> : null}
        {hub.fundingHistoryPreview && hub.fundingHistoryPreview.length > 0 ? (
          <div className="mt-4 border-t border-border/70 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('recentFundingTitle')}</p>
            <ul className="space-y-1 font-mono text-[11px]">
              {hub.fundingHistoryPreview.map((row) => (
                <li key={row.transactionId} className="flex flex-wrap justify-between gap-2">
                  <span>{fxPlain(row.type)}</span>
                  <span className="text-muted-foreground">{fxPlain(row.timestamp)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ForexPortalModuleCard>

      {/* Activity preview */}
      <ForexPortalModuleCard
        title={t('activityTitle')}
        actions={
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link href={FOREX_ROUTES.portfolio} className="text-primary hover:underline">{t('viewAllPositions')}</Link>
            <Link href={FOREX_ROUTES.orders} className="text-primary hover:underline">{t('viewAllOrders')}</Link>
            <Link href={FOREX_ROUTES.history} className="text-primary hover:underline">{t('viewAllHistory')}</Link>
            <Link href={FOREX_ROUTES.ledger} className="text-primary hover:underline">{t('viewLedger')}</Link>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('recentPositions')}</h4>
            {hub.preview.openPositions.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">{t('activityEmpty')}</p>
            ) : (
              <div className="space-y-2 md:hidden">
                {hub.preview.openPositions.map((p) => (
                  <article key={p.positionId} className="rounded border border-border/70 p-2.5 text-[11px]">
                    <p className="font-semibold">{fxPlain(p.symbol)} · {fxPlain(p.side)}</p>
                    <p className="text-muted-foreground">{t('colVolume')}: {fxPlain(p.volume)}</p>
                  </article>
                ))}
              </div>
            )}
            {hub.preview.openPositions.length > 0 ? (
              <div className="eda-table-wrap hidden overflow-x-auto md:block">
                <table className="eda-table min-w-[480px] text-[11px]">
                  <thead>
                    <tr>
                      <th>{t('colSymbol')}</th>
                      <th>{t('colSide')}</th>
                      <th>{t('colVolume')}</th>
                      <th>{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hub.preview.openPositions.map((p) => (
                      <tr key={p.positionId}>
                        <td>{fxPlain(p.symbol)}</td>
                        <td>{fxPlain(p.side)}</td>
                        <td>{fxPlain(p.volume)}</td>
                        <td>{fxPlain(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('recentFills')}</h4>
            {hub.preview.recentFills.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">{t('fillsEmpty')}</p>
            ) : (
              <div className="eda-table-wrap overflow-x-auto">
                <table className="eda-table min-w-[520px] text-[11px]">
                  <thead>
                    <tr>
                      <th>{t('colTime')}</th>
                      <th>{t('colSymbol')}</th>
                      <th>{t('colSide')}</th>
                      <th>{t('colVolume')}</th>
                      <th>{t('colPrice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hub.preview.recentFills.map((f) => (
                      <tr key={f.fillId}>
                        <td>{new Date(f.timestamp).toLocaleString()}</td>
                        <td>{fxPlain(f.symbol)}</td>
                        <td>{fxPlain(f.side)}</td>
                        <td>{fxPlain(f.volume)}</td>
                        <td>{fxNum(f.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </ForexPortalModuleCard>

      {/* Documents / info */}
      <ForexPortalModuleCard title={t('documentsTitle')}>
        <p className="text-[12px] text-muted-foreground">{t('documentsBody')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={ROUTES.dashboard.identity} className="text-[12px] font-medium text-primary underline-offset-2 hover:underline">
            {t('documentsVerification')}
          </Link>
          <Link href={ROUTES.dashboard.help} className="text-[12px] font-medium text-primary underline-offset-2 hover:underline">
            {t('documentsHelp')}
          </Link>
        </div>
      </ForexPortalModuleCard>

      {/* Lifecycle */}
      <ForexPortalModuleCard id="account-management" title={t('managementTitle')}>
        <p className="text-[12px] text-muted-foreground">{t('closeAccountUnavailable')}</p>
      </ForexPortalModuleCard>
    </div>
  );
}
