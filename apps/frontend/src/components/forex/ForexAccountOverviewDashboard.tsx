'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  CircleDollarSign,
  Gauge,
  LineChart,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fxMoney, fxPlain, fxSigned } from './format';
import { forexEnumLabel } from './forex-enum-label';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge, type ForexPortalKpiTone } from './ForexPortalKpiCard';

const overviewTitle = 'normal-case tracking-normal text-[13px] font-semibold text-foreground';

function pnlTone(value: string | number | null | undefined): ForexPortalKpiTone {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return 'neutral';
  return n > 0 ? 'positive' : 'negative';
}

function riskHealthKind(state: string | undefined, liquidationLock: boolean | undefined): 'normal' | 'warning' | 'locked' {
  if (liquidationLock) return 'locked';
  const s = String(state ?? '').toUpperCase();
  if (s === 'NORMAL' || s === '') return 'normal';
  if (s === 'WARNING' || s === 'RESTRICTED' || s === 'LIQUIDATION_ONLY' || s === 'HALTED') return 'warning';
  return 'warning';
}

export function ForexAccountOverviewDashboard() {
  const t = useTranslations('forex.accountPage');
  const te = useTranslations('forex.enums');
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
  const balanceValue = account?.ledgerBalance ?? balance?.ledgerBalance;
  const equityValue = account?.equity ?? balance?.equity;
  const unrealizedValue = account?.unrealizedPnl ?? pnl?.unrealized;
  const realized = fxSigned(account?.realizedPnl ?? pnl?.realized);
  const healthClass =
    health === 'locked' ? 'forex-overview-health--lock' : health === 'warning' ? 'forex-overview-health--warn' : 'forex-overview-health--ok';
  const quietLink = 'tap-target inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground hover:bg-muted/40';

  return (
    <div className="forex-overview space-y-5">
      <section className="forex-overview-hero p-4 sm:p-5" aria-label={t('activeAccountContextAria')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-medium text-muted-foreground">{t('activeAccountLabel')}</p>
              <ForexPortalStatusBadge tone={kindUpper === 'DEMO' ? 'primary' : 'neutral'}>{kindBadge}</ForexPortalStatusBadge>
              {activeMeta?.status ? (
                <ForexPortalStatusBadge tone="success">{forexEnumLabel(te, String(activeMeta.status))}</ForexPortalStatusBadge>
              ) : null}
            </div>
            <p className="truncate text-[15px] font-semibold text-foreground">
              {kindBadge} · {currency}
              <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground">
                #{fxPlain(account?.accountId ?? activeForexAccountId)}
              </span>
            </p>
            <div>
              <p className="text-[12px] text-muted-foreground">{t('metricBalance')}</p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground sm:text-[32px]">
                {fxMoney(balanceValue, currency)}
              </p>
            </div>
          </div>
          <Link
            href={FOREX_ROUTES.trade}
            className="tap-target inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('openTerminal')}
          </Link>
        </div>
        {needsDemo ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
            <p className="text-[13px] text-amber-100">{t('demoFundingHint')}</p>
            <Link href={FOREX_ROUTES.funds} className="text-[13px] font-semibold text-amber-100 underline-offset-2 hover:underline">
              {t('demoFundingCta')}
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('accountTotalsAria')}>
        <ForexPortalKpiCard tone="brand" emphasis="primary" icon={Wallet} label={t('metricBalance')} value={balanceValue} currency={currency} />
        <ForexPortalKpiCard tone="neutral" emphasis="primary" icon={CircleDollarSign} label={t('metricEquity')} value={equityValue} currency={currency} />
        <ForexPortalKpiCard tone="neutral" emphasis="primary" icon={Gauge} label={t('metricFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
        <ForexPortalKpiCard
          tone={pnlTone(unrealizedValue)}
          emphasis="primary"
          icon={LineChart}
          label={t('metricUnrealizedPnl')}
          value={unrealizedValue}
          currency={currency}
          signed
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <ForexPortalModuleCard className="lg:col-span-1" title={t('positionSummaryHeading')} titleClassName={overviewTitle}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3">
              <dt className="text-[12px] text-muted-foreground">{t('openPositionsLabel')}</dt>
              <dd className="mt-1 text-[26px] font-semibold tabular-nums text-foreground">{openPositionsCount}</dd>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3">
              <dt className="text-[12px] text-muted-foreground">{t('pendingOrdersLabel')}</dt>
              <dd className="mt-1 text-[26px] font-semibold tabular-nums text-foreground">{pendingOrdersCount}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={FOREX_ROUTES.portfolio} className="text-[13px] font-medium text-primary underline-offset-2 hover:underline">
              {t('viewPositions', { count: openPositionsCount })}
            </Link>
            <Link href={FOREX_ROUTES.orders} className="text-[13px] font-medium text-primary underline-offset-2 hover:underline">
              {t('viewOrders', { count: pendingOrdersCount })}
            </Link>
          </div>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard className="lg:col-span-1" title={t('accountSummaryHeading')} titleClassName={overviewTitle}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <dt className="text-[12px] text-muted-foreground">{t('accountIdServer')}</dt>
              <dd className="mt-0.5 break-all font-mono text-[12px] text-foreground">{fxPlain(account?.accountId ?? activeForexAccountId)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('mode')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium">{kindBadge}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('positionModeLabel')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium">{forexEnumLabel(te, activeMeta?.positionMode)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricMarginLevel')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium tabular-nums">
                {marginLevelRaw == null || marginLevelRaw === '' ? '—' : `${marginLevelRaw}%`}
              </dd>
              {marginLevelRaw == null ? <p className="text-[11px] text-muted-foreground">{t('marginLevelUnavailableHint')}</p> : null}
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricUsedMargin')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium tabular-nums">{fxMoney(account?.usedMargin ?? margin?.usedMargin, currency)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricAvailable')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium tabular-nums">{fxMoney(account?.availableBalance ?? balance?.availableBalance, currency)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricRealizedPnl')}</dt>
              <dd className={cn('mt-0.5 text-[14px] font-medium tabular-nums', realized.tone === 'pos' && 'text-buy', realized.tone === 'neg' && 'text-sell')}>
                {realized.text}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricFees')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium tabular-nums">{fxMoney(fees?.total, fees?.currency ?? currency)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('metricSwaps')}</dt>
              <dd className="mt-0.5 text-[14px] font-medium tabular-nums">{fxMoney(swaps?.total, swaps?.currency ?? currency)}</dd>
            </div>
          </dl>
          <Link
            href={FOREX_ROUTES.accounts}
            className="mt-4 inline-flex text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t('viewAccountDetail')}
          </Link>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard className={cn('lg:col-span-1', healthClass)} title={t('accountHealthHeading')} titleClassName={overviewTitle}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ForexPortalStatusBadge
              tone={health === 'normal' ? 'success' : health === 'locked' ? 'danger' : 'warning'}
            >
              <ShieldAlert className="h-3 w-3" aria-hidden />
              {healthLabel}
            </ForexPortalStatusBadge>
            <span className="text-[13px] text-muted-foreground">{stateLabel}</span>
          </div>
          {barPct != null ? (
            <div className="mt-4">
              <div className="flex justify-between text-[12px] text-muted-foreground">
                <span>{t('metricMarginLevel')}</span>
                <span className="tabular-nums text-foreground">{marginLevelNum}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-muted/50" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100}>
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
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('reason')}</dt>
              <dd className="mt-0.5 text-[14px]">{risk?.reason ? forexEnumLabel(te, risk.reason) : unavailable}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">{t('liquidationLock')}</dt>
              <dd className="mt-0.5 text-[14px]">{risk ? (risk.liquidationLock ? t('healthLocked') : t('liquidationClear')) : unavailable}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[12px] text-muted-foreground">{t('calculation')}</dt>
              <dd className="mt-0.5 text-[14px]">
                {(account?.calculationStatus ?? balance?.calculationStatus)
                  ? forexEnumLabel(te, String(account?.calculationStatus ?? balance?.calculationStatus))
                  : unavailable}
              </dd>
            </div>
          </dl>
        </ForexPortalModuleCard>
      </div>

      <ForexPortalModuleCard title={t('quickActionsHeading')} titleClassName={overviewTitle}>
        <div className="flex flex-wrap gap-2" aria-label={t('overviewQuickActionsAria')}>
          <Link href={FOREX_ROUTES.portfolio} className={quietLink}>
            {t('viewPositions', { count: openPositionsCount })}
          </Link>
          <Link href={FOREX_ROUTES.orders} className={quietLink}>
            {t('viewOrders', { count: pendingOrdersCount })}
          </Link>
          <Link href={FOREX_ROUTES.funds} className={quietLink}>
            {t('viewFunds')}
          </Link>
          <Link href={FOREX_ROUTES.ledger} className={quietLink}>
            {t('viewLedger')}
          </Link>
          <Link href={FOREX_ROUTES.history} className={quietLink}>
            {t('viewHistory')}
          </Link>
          {activeForexAccountId ? (
            <Link href={FOREX_ROUTES.accountDetail(activeForexAccountId)} className={quietLink}>
              {t('viewAccountDetail')}
            </Link>
          ) : null}
        </div>
      </ForexPortalModuleCard>

      <footer className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        {t('footerBalance', { amount: fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency) })}
        {lastHydratedAt ? t('footerUpdated', { time: new Date(lastHydratedAt).toLocaleString() }) : null}
      </footer>
    </div>
  );
}
