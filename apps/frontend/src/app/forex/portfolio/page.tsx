'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CircleDollarSign, Gauge, LineChart, Wallet } from 'lucide-react';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalKpiCard, ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { ForexPositionPanel } from '@/components/forex/ForexPositionPanel';
import { fxMoney, fxNum, fxPlain, fxSigned } from '@/components/forex/format';
import { forexEnumLabel } from '@/components/forex/forex-enum-label';
import { positionUnrealizedPnl } from '@/lib/forex/models/position';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';

export default function ForexPortfolioPage() {
  const tf = useTranslations('forex');
  const tp = useTranslations('forex.portfolioPage');
  const tcol = useTranslations('forex.portfolioPage.columns');
  const te = useTranslations('forex.enums');
  const session = useForexSession();
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
  const realized = fxSigned(account?.realizedPnl ?? pnl?.realized);

  return (
    <ForexPageFrame wide title={tf('pages.portfolio.title')} subtitle={tf('pages.portfolio.subtitle')}>
      {session.status !== 'AUTHENTICATED' ? (
        <ForexAuthPending status={session.status} href="/login?redirect=/forex/portfolio" sectionKey="portfolio" />
      ) : (
        <>
          <ForexPortalAccountContext />
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label={tp('summaryAria')}>
            <ForexPortalKpiCard tone="brand" emphasis="primary" icon={Wallet} label={tp('kpiBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexPortalKpiCard tone="neutral" emphasis="primary" icon={CircleDollarSign} label={tp('kpiEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexPortalKpiCard tone="neutral" emphasis="primary" icon={Gauge} label={tp('kpiFreeMargin')} value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexPortalKpiCard emphasis="primary" icon={LineChart} label={tp('kpiUnrealizedPnl')} value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
          </section>
          <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px]">
            <PortfolioQuiet label={tp('kpiUsedMargin')} value={fxMoney(account?.usedMargin ?? margin?.usedMargin, currency)} />
            <PortfolioQuiet label={tp('kpiGrossExposure')} value={fxMoney(margin?.grossExposure, currency)} />
            <PortfolioQuiet
              label={tp('kpiRealizedPnl')}
              value={realized.tone === 'na' ? realized.text : `${currency} ${realized.text}`}
              tone={realized.tone}
            />
            <PortfolioQuiet label={tp('kpiFees')} value={fxMoney(fees?.total, fees?.currency ?? currency)} />
            <PortfolioQuiet label={tp('kpiSwaps')} value={fxMoney(swaps?.total, swaps?.currency ?? currency)} />
          </p>

          <ForexPortalModuleCard
            title={tp('openPositionsBadge', { count: rows.length })}
            accent
            subtitle={tp('exposureSubtitle')}
          >
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
                          <td className={cn(p.side === 'long' ? 'text-buy' : 'text-sell')}>{forexEnumLabel(te, p.side)}</td>
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

function PortfolioQuiet(props: { label: string; value: string; tone?: 'pos' | 'neg' | 'flat' | 'na' }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{props.label}</span>
      <span
        className={cn(
          'font-mono tabular-nums text-foreground',
          props.tone === 'pos' && 'text-buy',
          props.tone === 'neg' && 'text-sell'
        )}
      >
        {props.value}
      </span>
    </span>
  );
}
