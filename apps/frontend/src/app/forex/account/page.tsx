'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxMoney, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.accountPage');
  const tu = useTranslations('forex.riskStates');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const risk = useForexStore((s) => s.riskStatus);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const activeForexAccountId = useForexStore((s) => s.activeForexAccountId);
  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const unavailable = tu('unavailable');
  const positions = useForexStore((s) => s.positions);
  const orders = useForexStore((s) => s.orders);

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

  return (
    <ForexPageFrame title={tf('pages.account.title')} subtitle={tf('pages.account.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account" sectionKey="yourForexAccount" />
      ) : !account && !balance ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <>
          <section className="eda-card flex flex-wrap items-center gap-2 p-3 text-sm" aria-label={t('overviewQuickActionsAria')}>
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary"
            >
              {t('openTerminal')}
            </Link>
            <Link href={FOREX_ROUTES.portfolio} className="text-primary underline underline-offset-2">
              {t('openPositionsCount', { count: openPositionsCount })}
            </Link>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <Link href={FOREX_ROUTES.orders} className="text-primary underline underline-offset-2">
              {t('pendingOrdersCount', { count: pendingOrdersCount })}
            </Link>
            {needsDemo ? (
              <>
                <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                  ·
                </span>
                <p className="w-full text-[11px] text-muted-foreground sm:w-auto sm:max-w-md">{t('demoFundingHint')}</p>
                <Link
                  href={FOREX_ROUTES.funds}
                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[12px] font-medium"
                >
                  {t('demoFundingCta')}
                </Link>
              </>
            ) : null}
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label={t('accountTotalsAria')}>
            <ForexMetric label={t('metricBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexMetric label={t('metricEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexMetric label={t('metricUsedMargin')} value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexMetric label={t('metricFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexMetric
              label={t('metricMarginLevel')}
              value={account?.marginLevel ?? margin?.marginLevel}
              kind="plain"
              hint={account?.marginLevel == null && margin?.marginLevel == null ? t('marginLevelUnavailableHint') : '%'}
            />
            <ForexMetric label={t('metricUnrealizedPnl')} value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={t('performanceAria')}>
            <ForexMetric label={t('metricRealizedPnl')} value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexMetric label={t('metricFees')} value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexMetric label={t('metricSwaps')} value={swaps?.total} currency={swaps?.currency ?? currency} />
            <ForexMetric label={t('metricAvailable')} value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
          </section>

          <section className="eda-card p-4 text-sm" aria-label={t('identityAria')}>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t('tradingAccountHeading')}</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-[12px] md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('accountIdServer')}</dt>
                <dd>{fxPlain(account?.accountId ?? activeForexAccountId)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('mode')}</dt>
                <dd>{t('modeValue')}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t.rich('manageAccountsHint', {
                accountsLink: (chunks) => (
                  <Link href={FOREX_ROUTES.accounts} className="text-primary underline underline-offset-2">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          <section className="eda-card p-4 text-sm">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t('riskHeading')}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-[12px] md:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{t('state')}</dt>
                <dd>{fxPlain(risk?.state)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('reason')}</dt>
                <dd>{fxPlain(risk?.reason)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('liquidationLock')}</dt>
                <dd>{risk ? String(risk.liquidationLock) : unavailable}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('calculation')}</dt>
                <dd>{fxPlain(account?.calculationStatus ?? balance?.calculationStatus)}</dd>
              </div>
            </dl>
          </section>

          <p className="text-sm text-muted-foreground">
            <Link href={FOREX_ROUTES.ledger} className="text-primary underline underline-offset-2">
              {t('footerLedger')}
            </Link>
            {' · '}
            <Link href={FOREX_ROUTES.funds} className="text-primary underline underline-offset-2">
              {t('footerFunds')}
            </Link>
            {' · '}
            {t('footerBalance', { amount: fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency) })}
            {lastHydratedAt
              ? t('footerUpdated', { time: new Date(lastHydratedAt).toLocaleString() })
              : ''}
          </p>
        </>
      )}
    </ForexPageFrame>
  );
}
