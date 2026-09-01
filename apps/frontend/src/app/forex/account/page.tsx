'use client';

import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { fxMoney, fxPlain } from '@/components/forex/format';

export default function ForexAccountPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const funding = useForexStore((s) => s.funding);
  const risk = useForexStore((s) => s.riskStatus);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const currency = account?.currency ?? balance?.currency ?? 'USD';

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Account</h1>
          <p className="text-[12px] text-stone-500">Backend-authoritative Forex cash, margin, and P&amp;L. Source: GET /account, /balance, /margin, /pnl.</p>
        </div>
        <ForexAccountNav />
      </div>

      {!authed ? (
        <p className="rounded border border-stone-200 bg-white p-4 text-[13px] text-stone-600 dark:border-stone-800 dark:bg-[#101214]">
          Sign in to load private Forex account fields.{' '}
          <Link href="/login?redirect=/forex/account" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      ) : !account && !balance ? (
        <p className="text-[13px] text-stone-500">Waiting for GET /api/v1/forex/account…</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6" aria-label="Account totals">
            <ForexMetric label="Balance" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} hint="ledgerBalance" />
            <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} hint="CUSTOMER_CASH + uPnL" />
            <ForexMetric label="Available" value={account?.availableBalance ?? balance?.availableBalance} currency={currency} hint="free margin" />
            <ForexMetric label="Used margin" value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexMetric label="Free margin" value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexMetric
              label="Margin level"
              value={account?.marginLevel ?? margin?.marginLevel}
              kind="plain"
              hint={account?.marginLevel == null && margin?.marginLevel == null ? 'null when unused' : '%'}
            />
          </section>

          <section className="grid grid-cols-2 gap-2 md:grid-cols-5" aria-label="Performance">
            <ForexMetric label="Realized P&L" value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexMetric label="Unrealized P&L" value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
            <ForexMetric label="Fees" value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexMetric label="Swaps" value={swaps?.total} currency={swaps?.currency ?? currency} />
            <ForexMetric label="Funding rows" value={String(funding.length)} kind="plain" hint="GET /funding" />
          </section>

          <section className="rounded border border-stone-200 bg-white p-3 text-[12px] dark:border-stone-800 dark:bg-[#101214]">
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Risk</h2>
            <dl className="grid grid-cols-2 gap-2 font-mono md:grid-cols-4">
              <div>
                <dt className="text-stone-400">State</dt>
                <dd>{fxPlain(risk?.state)}</dd>
              </div>
              <div>
                <dt className="text-stone-400">Reason</dt>
                <dd>{fxPlain(risk?.reason)}</dd>
              </div>
              <div>
                <dt className="text-stone-400">Liquidation lock</dt>
                <dd>{risk ? String(risk.liquidationLock) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-stone-400">Calc</dt>
                <dd>{fxPlain(account?.calculationStatus ?? balance?.calculationStatus)}</dd>
              </div>
            </dl>
          </section>

          <p className="text-[12px] text-stone-500">
            <Link href={FOREX_ROUTES.ledger} className="underline underline-offset-2">
              Open ledger
            </Link>
            {' · '}
            <Link href={FOREX_ROUTES.funds} className="underline underline-offset-2">
              Funds
            </Link>
            {' · '}
            Balance {fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency)}
            {lastHydratedAt ? ` · Last updated ${new Date(lastHydratedAt).toLocaleString()}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
