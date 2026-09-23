'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import { fxMoney, fxPlain, fxSigned } from './format';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';

function KpiCell(props: {
  label: string;
  value: string | number | null | undefined;
  currency?: string;
  signed?: boolean;
  hint?: string;
  kind?: 'money' | 'plain';
  emphasis: 'primary' | 'secondary';
}) {
  const signed = props.signed ? fxSigned(props.value) : null;
  const text = signed
    ? signed.text
    : props.kind === 'plain'
      ? props.value == null || props.value === ''
        ? '—'
        : String(props.value)
      : fxMoney(props.value, props.currency ?? 'USD');
  const tone = signed?.tone;
  const primary = props.emphasis === 'primary';
  return (
    <div
      className={cn(
        'eda-metric min-w-0',
        primary ? 'border-primary/25 bg-card/95' : 'border-border/80 bg-card/70 opacity-95'
      )}
    >
      <div className={cn('uppercase tracking-[0.1em] text-muted-foreground', primary ? 'text-[10px]' : 'text-[9px]')}>
        {props.label}
      </div>
      <div
        className={cn(
          'mt-1 font-mono tabular-nums leading-tight',
          primary ? 'text-[17px] sm:text-[18px]' : 'text-[13px]',
          tone === 'pos' ? 'text-buy' : tone === 'neg' ? 'text-sell' : 'text-foreground'
        )}
      >
        {text}
      </div>
      {props.hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
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

  return (
    <div className="space-y-3">
      <section className="eda-card border-primary/20 bg-card/95 p-3 sm:p-4" aria-label={t('activeAccountContextAria')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/90">{t('activeAccountLabel')}</p>
            <ForexAccountSwitcher />
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
        <KpiCell emphasis="primary" label={t('metricBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
        <KpiCell emphasis="primary" label={t('metricEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
        <KpiCell emphasis="primary" label={t('metricFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
        <KpiCell
          emphasis="primary"
          label={t('metricMarginLevel')}
          value={marginLevelRaw}
          kind="plain"
          hint={marginLevelRaw == null ? t('marginLevelUnavailableHint') : '%'}
        />
        <KpiCell
          emphasis="primary"
          label={t('metricUnrealizedPnl')}
          value={account?.unrealizedPnl ?? pnl?.unrealized}
          currency={currency}
          signed
        />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label={t('performanceAria')}>
        <KpiCell emphasis="secondary" label={t('metricUsedMargin')} value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
        <KpiCell emphasis="secondary" label={t('metricRealizedPnl')} value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
        <KpiCell emphasis="secondary" label={t('metricFees')} value={fees?.total} currency={fees?.currency ?? currency} />
        <KpiCell emphasis="secondary" label={t('metricSwaps')} value={swaps?.total} currency={swaps?.currency ?? currency} />
        <KpiCell emphasis="secondary" label={t('metricAvailable')} value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="eda-card p-4 text-sm" aria-label={t('identityAria')}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('accountSummaryHeading')}</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 font-mono text-[12px] sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('accountIdServer')}</dt>
              <dd className="mt-0.5 text-foreground">{fxPlain(account?.accountId ?? activeForexAccountId)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('accountKindLabel')}</dt>
              <dd className="mt-0.5">{fxPlain(activeMeta?.accountKind)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('accountCurrencyLabel')}</dt>
              <dd className="mt-0.5">{fxPlain(activeMeta?.currency ?? currency)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('accountStatusLabel')}</dt>
              <dd className="mt-0.5">{fxPlain(activeMeta?.status)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('mode')}</dt>
              <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t('modeValue')}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('positionModeLabel')}</dt>
              <dd className="mt-0.5">{fxPlain(activeMeta?.positionMode)}</dd>
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
        </section>

        <section className="eda-card p-4 text-sm" aria-label={t('accountHealthHeading')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('accountHealthHeading')}</h2>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                health === 'normal' && 'border-buy/40 bg-buy/10 text-buy',
                health === 'warning' && 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                health === 'locked' && 'border-sell/40 bg-sell/10 text-sell'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  health === 'normal' && 'bg-buy',
                  health === 'warning' && 'bg-amber-400',
                  health === 'locked' && 'bg-sell'
                )}
                aria-hidden
              />
              {healthLabel}
            </span>
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
          <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-[12px]">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('state')}</dt>
              <dd className="mt-0.5">{stateLabel}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('reason')}</dt>
              <dd className="mt-0.5">{fxPlain(risk?.reason)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('liquidationLock')}</dt>
              <dd className="mt-0.5">{risk ? String(risk.liquidationLock) : unavailable}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('calculation')}</dt>
              <dd className="mt-0.5">{fxPlain(account?.calculationStatus ?? balance?.calculationStatus)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="eda-card p-3 sm:p-4" aria-label={t('quickActionsHeading')}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('quickActionsHeading')}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={FOREX_ROUTES.trade}
            className="tap-target inline-flex items-center rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary"
          >
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
      </section>

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
