'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CircleDollarSign, Gauge, LineChart, Wallet } from 'lucide-react';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { ForexPositionPanel } from '@/components/forex/ForexPositionPanel';
import { fxMoney, fxNum, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { positionUnrealizedPnl } from '@/lib/forex/models/position';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

export default function ForexPortfolioPage() {
  const tf = useTranslations('forex');
  const tp = useTranslations('forex.portfolioPage');
  const tcol = useTranslations('forex.portfolioPage.columns');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const positions = useForexStore((s) => s.positions);
  const exposure = useForexStore((s) => s.exposure);
  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const rows = useMemo(() => Object.values(positions).filter((p) => p.status === 'OPEN'), [positions]);

  return (
    <ForexPageFrame wide title={tf('pages.portfolio.title')} subtitle={tf('pages.portfolio.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/portfolio" sectionKey="portfolio" />
      ) : (
        <>
          <section className="flex flex-wrap items-center justify-between gap-2">
            <ForexPortalStatusBadge tone="primary">{tp('openPositionsBadge', { count: rows.length })}</ForexPortalStatusBadge>
          </section>

          <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6 md:gap-3" aria-label={tp('summaryAria')}>
            <ForexPortalKpiCard emphasis="primary" icon={Wallet} label={tp('kpiBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" icon={CircleDollarSign} label={tp('kpiEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexPortalKpiCard emphasis="secondary" label={tp('kpiUsedMargin')} value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" icon={Gauge} label={tp('kpiFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" icon={LineChart} label={tp('kpiUnrealizedPnl')} value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
            <ForexPortalKpiCard emphasis="secondary" label={tp('kpiGrossExposure')} value={margin?.grossExposure} currency={currency} />
          </section>

          <section className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
            <ForexPortalKpiCard emphasis="secondary" label={tp('kpiRealizedPnl')} value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexPortalKpiCard emphasis="secondary" label={tp('kpiFees')} value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexPortalKpiCard emphasis="secondary" label={tp('kpiSwaps')} value={swaps?.total} currency={swaps?.currency ?? currency} />
          </section>

          <ForexPortalModuleCard title={tp('exposureHeading')} accent subtitle={tp('exposureSubtitle')}>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tp('noOpenPositions')}</p>
            ) : (
              <div className="eda-table-wrap -mx-1 border-0">
                <table className="eda-table min-w-[800px] font-mono text-[12px]">
                  <thead>
                    <tr>
                      <th>{tcol('symbol')}</th>
                      <th>{tcol('side')}</th>
                      <th>{tcol('volume')}</th>
                      <th>{tcol('notional')}</th>
                      <th>{tcol('entry')}</th>
                      <th>{tcol('current')}</th>
                      <th>{tp('colPnl')}</th>
                      <th>{tcol('margin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const upnl = positionUnrealizedPnl(pnl, p);
                      return (
                        <tr key={p.positionId}>
                          <td>{p.symbol}</td>
                          <td className={cn(p.side === 'long' ? 'text-buy' : 'text-sell')}>{p.side}</td>
                          <td>{fxPlain(p.volume)}</td>
                          <td>{fxMoney(p.exposure, currency)}</td>
                          <td>{fxNum(p.entryPrice, 5)}</td>
                          <td>{fxNum(p.currentPrice, 5)}</td>
                          <td>{upnl.available ? fxMoney(upnl.value, upnl.currency ?? currency) : tp('pnlUnavailable')}</td>
                          <td>{fxMoney(p.initialMargin, currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {exposure ? (
              <p className="mt-3 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
                {tp('accountNet')}{' '}
                {fxPlain(
                  typeof exposure.net === 'string'
                    ? exposure.net
                    : typeof exposure.accountNet === 'string'
                      ? exposure.accountNet
                      : null
                )}
              </p>
            ) : null}
          </ForexPortalModuleCard>

          <ForexPositionPanel />
        </>
      )}
    </ForexPageFrame>
  );
}
