'use client';

import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxMoney, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexAccountPage() {
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

  return (
    <ForexPageFrame
      title="Account"
      subtitle="FOREX DEMO ACCOUNT · SIMULATED / MOCK. Not real money. Real Forex and live LP remain OFF."
      actions={<ForexAccountNav />}
    >
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account" label="your Forex account" />
      ) : !account && !balance ? (
        <p className="text-sm text-muted-foreground">Loading account…</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Account totals">
            <ForexMetric label="Balance" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} />
            <ForexMetric label="Used margin" value={account?.usedMargin ?? margin?.usedMargin} currency={currency} />
            <ForexMetric label="Free margin" value={account?.freeMargin ?? margin?.freeMargin} currency={currency} />
            <ForexMetric
              label="Margin level"
              value={account?.marginLevel ?? margin?.marginLevel}
              kind="plain"
              hint={account?.marginLevel == null && margin?.marginLevel == null ? 'Unavailable when unused' : '%'}
            />
            <ForexMetric label="Unrealized P&L" value={account?.unrealizedPnl ?? pnl?.unrealized} currency={currency} signed />
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Performance">
            <ForexMetric label="Realized P&L" value={account?.realizedPnl ?? pnl?.realized} currency={currency} signed />
            <ForexMetric label="Fees" value={fees?.total} currency={fees?.currency ?? currency} />
            <ForexMetric label="Swaps" value={swaps?.total} currency={swaps?.currency ?? currency} />
            <ForexMetric label="Available" value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
          </section>

          <section className="eda-card p-4 text-sm" aria-label="Trading account identity">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Trading account</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-[12px] md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Account ID (server)</dt>
                <dd>{fxPlain(account?.accountId ?? activeForexAccountId)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd>SIMULATED / MOCK · server-scoped active account</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Manage demo accounts on{' '}
              <Link href={FOREX_ROUTES.accounts} className="text-primary underline underline-offset-2">
                Forex accounts
              </Link>
              . Use the terminal bar switcher for quick changes. Orders, positions, ledger, history, risk, margin, and
              alerts always follow the server-selected active account.
            </p>
          </section>

          <section className="eda-card p-4 text-sm">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Risk</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-[12px] md:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">State</dt>
                <dd>{fxPlain(risk?.state)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reason</dt>
                <dd>{fxPlain(risk?.reason)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Liquidation lock</dt>
                <dd>{risk ? String(risk.liquidationLock) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Calculation</dt>
                <dd>{fxPlain(account?.calculationStatus ?? balance?.calculationStatus)}</dd>
              </div>
            </dl>
          </section>

          <p className="text-sm text-muted-foreground">
            <Link href={FOREX_ROUTES.ledger} className="text-primary underline underline-offset-2">
              Ledger
            </Link>
            {' · '}
            <Link href={FOREX_ROUTES.funds} className="text-primary underline underline-offset-2">
              Funds
            </Link>
            {' · '}
            Balance {fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency)}
            {lastHydratedAt ? ` · Updated ${new Date(lastHydratedAt).toLocaleString()}` : ''}
          </p>
        </>
      )}
    </ForexPageFrame>
  );
}
