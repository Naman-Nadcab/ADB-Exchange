'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
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
  const rows = Object.values(positions);

  return (
    <ForexPageFrame
      wide
      title={tf('pages.portfolio.title')}
      subtitle={tf('pages.portfolio.subtitle')}
      actions={<ForexAccountNav />}
    >
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/portfolio" sectionKey="portfolio" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <ForexMetric label="Balance" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexMetric label="Used margin" value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexMetric label="Free margin" value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexMetric label="Unrealized P&L" value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
            <ForexMetric label="Gross exposure" value={margin?.grossExposure} currency={currency} />
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <ForexMetric label="Realized P&L" value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexMetric label="Fees" value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexMetric label="Swaps" value={swaps?.total} currency={swaps?.currency ?? currency} />
          </section>

          <section className="eda-card overflow-hidden">
            <h2 className="border-b border-border px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {tp('exposureHeading')}
            </h2>
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{tp('noOpenPositions')}</p>
            ) : (
              <div className="eda-table-wrap border-0">
                <table className="eda-table min-w-[800px] font-mono text-[12px]">
                  <thead>
                    <tr>
                      <th>{tcol('symbol')}</th>
                      <th>{tcol('side')}</th>
                      <th>{tcol('volume')}</th>
                      <th>{tcol('notional')}</th>
                      <th>{tcol('entry')}</th>
                      <th>{tcol('current')}</th>
                      <th>P&amp;L</th>
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
                          <td>{upnl.available ? fxMoney(upnl.value, upnl.currency ?? currency) : 'Unavailable'}</td>
                          <td>{fxMoney(p.initialMargin, currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {exposure ? (
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
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
          </section>

          <ForexPositionPanel />
        </>
      )}
    </ForexPageFrame>
  );
}
