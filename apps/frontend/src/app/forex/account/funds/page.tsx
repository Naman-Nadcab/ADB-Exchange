'use client';

import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexFundsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const funding = useForexStore((s) => s.funding);
  const currency = account?.currency ?? balance?.currency ?? 'USD';

  return (
    <ForexPageFrame
      title="Funds"
      subtitle="Forex funding rails are currently unavailable. Account balances and activity remain visible through Account and Ledger."
      actions={<ForexAccountNav />}
    >
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/funds" label="funds" />
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ForexMetric label="Available balance" value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
          <ForexMetric label="Ledger balance" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
          <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} />
          <ForexMetric label="Used margin" value={account?.usedMargin} currency={currency} />
        </section>
      )}

      <section className="eda-card-featured p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Funds</p>
        <h2 className="mt-1 text-lg font-semibold">Forex funding rails are currently unavailable</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Deposit, withdrawal and transfer are not offered. Account balances and financial activity remain visible through
          Account and Ledger.
        </p>
        <Link href={FOREX_ROUTES.ledger} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          View Ledger
        </Link>
      </section>

      {authed ? (
        <section className="eda-card p-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Account activity</h2>
          {funding.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No Forex account activity.</p>
          ) : (
            <div className="eda-table-wrap mt-3">
              <table className="eda-table font-mono text-[12px]">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map((row) => (
                    <tr key={row.transactionId}>
                      <td>{fxPlain(row.timestamp)}</td>
                      <td>{fxPlain(row.type)}</td>
                      <td>{fxPlain(row.cashDebit ?? row.debit)}</td>
                      <td>{fxPlain(row.cashCredit ?? row.credit)}</td>
                      <td>{fxPlain(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </ForexPageFrame>
  );
}
