'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  ArrowLeftRight,
  CircleDollarSign,
  Gauge,
  Landmark,
  LayoutGrid,
  LineChart,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import { fxMoney, fxPlain } from './format';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';

function riskHealthKind(state: string | undefined, liquidationLock: boolean | undefined): 'normal' | 'warning' | 'locked' {
  if (liquidationLock) return 'locked';
  const s = String(state ?? '').toUpperCase();
  if (s === 'NORMAL' || s === '') return 'normal';
  if (s === 'WARNING' || s === 'RESTRICTED' || s === 'LIQUIDATION_ONLY' || s === 'HALTED') return 'warning';
  return 'warning';
}

export function ForexAccountOverviewDashboard() {
  const t = useTranslations('forex.accountPage');
  const tu = useTranslations('forex.riskStates');
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const risk = useForexStore((s) => s.riskStatus);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const activeForexAccountId = useForexStore((s) => s.activeForexAccountId);
  const forexAccounts = useForexStore((s) => s.forexAccounts);
  const positions = useForexStore((s) => s.positions);
  const orders = useForexStore((s) => s.orders);

  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const unavailable = tu('unavailable');
  const activeMeta = forexAccounts.find((a) => a.accountId === (account?.accountId ?? activeForexAccountId)) ?? forexAccounts[0];

  const { openPositionsCount, pendingOrdersCount } = useMemo(() => {
    const openPositionsCount = Object.values(positions).filter((p) => p.status === 'OPEN').length;
    const pendingOrdersCount = Object.values(orders).filter((o) => {
      const st = String(o.status ?? '').toUpperCase();
      return st === 'NEW' || st === 'PARTIAL' || st === 'OPEN' || st === 'WORKING' || st === 'ACCEPTED';
    }).length;
    return { openPositionsCount, pendingOrdersCount };
  }, [positions, orders]);

  const ledger = Number(account?.ledgerBalance ?? balance?.ledgerBalance ?? 0);
  const needsDemo = Number.isFinite(ledger) && ledger <= 0;
  const marginLevelRaw = account?.marginLevel ?? margin?.marginLevel;
  const marginLevelNum = marginLevelRaw != null && marginLevelRaw !== '' ? Number(marginLevelRaw) : NaN;
  const health = riskHealthKind(risk?.state, risk?.liquidationLock);
  const stateKey = risk?.state ? String(risk.state).toUpperCase() : '';
  const stateLabel =
    stateKey && stateKey in { NORMAL: 1, WARNING: 1, RESTRICTED: 1, LIQUIDATION_ONLY: 1, HALTED: 1 }
      ? tu(stateKey as 'NORMAL')
      : fxPlain(risk?.state);

  const healthLabel =
    health === 'locked' ? t('healthLocked') : health === 'warning' ? t('healthWarning') : t('healthNormal');

  const barPct = Number.isFinite(marginLevelNum) ? Math.min(100, Math.max(0, marginLevelNum)) : null;

  const kindUpper = String(activeMeta?.accountKind ?? '').toUpperCase();
  const kindBadge =
    kindUpper === 'DEMO' ? t('kindDemo') : kindUpper === 'LIVE' || kindUpper === 'REAL' ? t('kindLive') : fxPlain(activeMeta?.accountKind);

  return (
    <div className="space-y-3">
      <section
        className="eda-card border-primary/25 bg-gradient-to-r from-card via-card to-primary/[0.05] p-3 sm:p-4"
        aria-label={t('activeAccountContextAria')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/90">{t('activeAccountLabel')}</p>
              <ForexPortalStatusBadge tone={kindUpper === 'DEMO' ? 'primary' : 'neutral'}>{kindBadge}</ForexPortalStatusBadge>
              {activeMeta?.status ? (
                <ForexPortalStatusBadge tone="success">{fxPlain(activeMeta.status)}</ForexPortalStatusBadge>
              ) : null}
            </div>
            <ForexAccountSwitcher />
            <p className="font-mono text-[11px] text-muted-foreground">
              {fxPlain(activeMeta?.currency ?? currency)} · {fxPlain(account?.accountId ?? activeForexAccountId)}
            </p>
          </div>
          <Link
            href={FOREX_ROUTES.trade}
            className="tap-target inline-flex shrink-0 items-center justify-center rounded border border-primary/45 bg-primary/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('openTerminal')}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5" aria-label={t('accountTotalsAria')}>
        <ForexPortalKpiCard emphasis="primary" icon={Wallet} label={t('metricBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
        <ForexPortalKpiCard emphasis="primary" icon={CircleDollarSign} label={t('metricEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
        <ForexPortalKpiCard emphasis="primary" icon={Gauge} label={t('metricFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
        <ForexPortalKpiCard
          emphasis="primary"
          icon={Activity}
          label={t('metricMarginLevel')}
          value={marginLevelRaw}
          kind="plain"
          hint={marginLevelRaw == null ? t('marginLevelUnavailableHint') : '%'}
        />
        <ForexPortalKpiCard
          emphasis="primary"
          icon={LineChart}
          label={t('metricUnrealizedPnl')}
          value={account?.unrealizedPnl ?? pnl?.unrealized}
          currency={currency}
          signed
        />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label={t('performanceAria')}>
        <ForexPortalKpiCard emphasis="secondary" icon={Landmark} label={t('metricUsedMargin')} value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
        <ForexPortalKpiCard emphasis="secondary" label={t('metricRealizedPnl')} value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
        <ForexPortalKpiCard emphasis="secondary" label={t('metricFees')} value={fees?.total} currency={fees?.currency ?? currency} />
        <ForexPortalKpiCard emphasis="secondary" icon={ArrowLeftRight} label={t('metricSwaps')} value={swaps?.total} currency={swaps?.currency ?? currency} />
        <ForexPortalKpiCard emphasis="secondary" label={t('metricAvailable')} value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <ForexPortalModuleCard className="lg:col-span-1" title={t('positionSummaryHeading')} accent>
          <dl className="grid grid-cols-2 gap-3 font-mono text-[12px]">
            <div className="rounded border border-border/70 bg-muted/10 px-2.5 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('openPositionsLabel')}</dt>
              <dd className="mt-1 text-[18px] font-semibold tabular-nums text-foreground">{openPositionsCount}</dd>
            </div>
            <div className="rounded border border-border/70 bg-muted/10 px-2.5 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pendingOrdersLabel')}</dt>
              <dd className="mt-1 text-[18px] font-semibold tabular-nums text-foreground">{pendingOrdersCount}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={FOREX_ROUTES.portfolio} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
              {t('viewPositions', { count: openPositionsCount })}
            </Link>
            <Link href={FOREX_ROUTES.orders} className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
              {t('viewOrders', { count: pendingOrdersCount })}
            </Link>
          </div>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard className="lg:col-span-1" title={t('accountSummaryHeading')}>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 font-mono text-[12px] sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('accountIdServer')}</dt>
              <dd className="mt-0.5 text-foreground">{fxPlain(account?.accountId ?? activeForexAccountId)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('positionModeLabel')}</dt>
              <dd className="mt-0.5">{fxPlain(activeMeta?.positionMode)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('mode')}</dt>
              <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t('modeValue')}</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-border/80 pt-3 text-[11px] text-muted-foreground">
            {t.rich('manageAccountsHint', {
              accountsLink: (chunks) => (
                <Link href={FOREX_ROUTES.accounts} className="text-primary underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard className="lg:col-span-1" title={t('accountHealthHeading')} accent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ForexPortalStatusBadge
              tone={health === 'normal' ? 'success' : health === 'locked' ? 'danger' : 'warning'}
            >
              <ShieldAlert className="h-3 w-3" aria-hidden />
              {healthLabel}
            </ForexPortalStatusBadge>
            <span className="font-mono text-[11px] text-muted-foreground">{stateLabel}</span>
          </div>
          {barPct != null ? (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t('metricMarginLevel')}</span>
                <span className="font-mono tabular-nums text-foreground">{marginLevelNum}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-muted/50" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={cn(
                    'h-full transition-all',
                    health === 'normal' && 'bg-buy/80',
                    health === 'warning' && 'bg-amber-500/80',
                    health === 'locked' && 'bg-sell/80'
                  )}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('reason')}</dt>
              <dd className="mt-0.5">{fxPlain(risk?.reason)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('liquidationLock')}</dt>
              <dd className="mt-0.5">{risk ? String(risk.liquidationLock) : unavailable}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('calculation')}</dt>
              <dd className="mt-0.5">{fxPlain(account?.calculationStatus ?? balance?.calculationStatus)}</dd>
            </div>
          </dl>
        </ForexPortalModuleCard>
      </div>

      <ForexPortalModuleCard title={t('quickActionsHeading')}>
        <div className="flex flex-wrap gap-2">
          <Link
            href={FOREX_ROUTES.trade}
            className="tap-target inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            {t('openTerminal')}
          </Link>
          <Link href={FOREX_ROUTES.portfolio} className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40">
            {t('viewPositions', { count: openPositionsCount })}
          </Link>
          <Link href={FOREX_ROUTES.orders} className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40">
            {t('viewOrders', { count: pendingOrdersCount })}
          </Link>
          <Link href={FOREX_ROUTES.funds} className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40">
            {t('viewFunds')}
          </Link>
          <Link href={FOREX_ROUTES.ledger} className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40">
            {t('viewLedger')}
          </Link>
          <Link href={FOREX_ROUTES.history} className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40">
            {t('viewHistory')}
          </Link>
          {activeForexAccountId ? (
            <Link
              href={FOREX_ROUTES.accountDetail(activeForexAccountId)}
              className="tap-target inline-flex items-center rounded border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
            >
              {t('viewAccountDetail')}
            </Link>
          ) : null}
          {needsDemo ? (
            <Link
              href={FOREX_ROUTES.funds}
              className="tap-target inline-flex items-center rounded border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-100"
            >
              {t('demoFundingCta')}
            </Link>
          ) : null}
        </div>
        {needsDemo ? <p className="mt-2 text-[11px] text-muted-foreground">{t('demoFundingHint')}</p> : null}
      </ForexPortalModuleCard>

      <footer className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        {t('footerBalance', { amount: fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency) })}
        {lastHydratedAt ? t('footerUpdated', { time: new Date(lastHydratedAt).toLocaleString() }) : null}
        {' · '}
        <Link href={FOREX_ROUTES.ledger} className="text-primary underline underline-offset-2">
          {t('footerLedger')}
        </Link>
        {' · '}
        <Link href={FOREX_ROUTES.funds} className="text-primary underline underline-offset-2">
          {t('footerFunds')}
        </Link>
      </footer>
    </div>
  );
}
