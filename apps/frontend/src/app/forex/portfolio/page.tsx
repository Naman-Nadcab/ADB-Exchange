'use client';

import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPositionPanel } from '@/components/forex/ForexPositionPanel';
import { fxMoney, fxNum, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { positionUnrealizedPnl } from '@/lib/forex/models/position';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';

export default function ForexPortfolioPage() {
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
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Portfolio</h1>
          <p className="text-[12px] text-stone-500">Positions, P&amp;L, and exposure from the Forex backend.</p>
        </div>
        <ForexAccountNav />
      </div>

      {!authed ? (
        <p className="text-[13px] text-stone-500">
          Sign in to view portfolio.{' '}
          <Link href="/login?redirect=/forex/portfolio" className="underline">
            Sign in
          </Link>
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <ForexMetric label="Balance" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexMetric label="Available" value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
            <ForexMetric label="Used margin" value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexMetric label="Free margin" value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexMetric label="Unrealized" value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
          </section>

          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <ForexMetric label="Realized P&L" value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexMetric label="Fees" value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexMetric label="Swaps" value={swaps?.total} currency={swaps?.currency ?? currency} />
            <ForexMetric label="Gross exposure" value={margin?.grossExposure} currency={currency} />
          </section>

          <section className="overflow-x-auto rounded border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]">
            <h2 className="border-b border-stone-200 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:border-stone-800">
              Exposure
            </h2>
            {rows.length === 0 ? (
              <p className="p-3 text-[13px] text-stone-500">No open Forex positions.</p>
            ) : (
              <table className="min-w-[800px] w-full text-left font-mono text-[12px]">
                <thead className="text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Volume</th>
                    <th className="px-3 py-2 font-medium">Notional</th>
                    <th className="px-3 py-2 font-medium">Entry</th>
                    <th className="px-3 py-2 font-medium">Current</th>
                    <th className="px-3 py-2 font-medium">P&amp;L</th>
                    <th className="px-3 py-2 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const upnl = positionUnrealizedPnl(pnl, p);
                    return (
                      <tr key={p.positionId} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="px-3 py-2">{p.symbol}</td>
                        <td className="px-3 py-2">{p.side}</td>
                        <td className="px-3 py-2">{fxPlain(p.volume)}</td>
                        <td className="px-3 py-2">{fxMoney(p.exposure, currency)}</td>
                        <td className="px-3 py-2">{fxNum(p.entryPrice, 5)}</td>
                        <td className="px-3 py-2">{fxNum(p.currentPrice, 5)}</td>
                        <td className="px-3 py-2">{upnl.available ? fxMoney(upnl.value, upnl.currency ?? currency) : 'Unavailable'}</td>
                        <td className="px-3 py-2">{fxMoney(p.initialMargin, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {exposure ? (
              <p className="border-t border-stone-100 px-3 py-2 text-[11px] text-stone-500 dark:border-stone-800">
                Account net {fxPlain(typeof exposure.net === 'string' ? exposure.net : typeof exposure.accountNet === 'string' ? exposure.accountNet : null)} · GET /exposure
              </p>
            ) : null}
          </section>

          <ForexPositionPanel />
        </>
      )}
    </div>
  );
}
