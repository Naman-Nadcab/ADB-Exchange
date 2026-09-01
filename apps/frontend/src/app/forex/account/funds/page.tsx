'use client';

import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { fxPlain } from '@/components/forex/format';

export default function ForexFundsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const funding = useForexStore((s) => s.funding);
  const currency = account?.currency ?? balance?.currency ?? 'USD';

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Funds</h1>
          <p className="text-[12px] text-stone-500">Forex cash position from the Forex ledger. Crypto wallet rails are not used.</p>
        </div>
        <ForexAccountNav />
      </div>

      {!authed ? (
        <p className="text-[13px] text-stone-500">
          Sign in to view funds.{' '}
          <Link href="/login?redirect=/forex/account/funds" className="underline">
            Sign in
          </Link>
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <ForexMetric label="Total funds" value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexMetric label="Available" value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
            <ForexMetric label="Locked as margin" value={account?.usedMargin} currency={currency} />
            <ForexMetric label="Equity" value={account?.equity ?? balance?.equity} currency={currency} />
          </section>

          <section className="rounded border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-[#101214]">
            <h2 className="text-sm font-medium">Deposit / withdrawal / transfer</h2>
            <p className="mt-2 text-[13px] text-stone-600 dark:text-stone-300">Funding unavailable</p>
            <p className="mt-1 text-[12px] text-stone-500">
              There is no customer Forex deposit, withdrawal, or transfer API. POST /funding/test is a simulated test credit and is not offered here.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Funding history · GET /funding</h2>
            {funding.length === 0 ? (
              <p className="text-[13px] text-stone-500">No Forex account activity.</p>
            ) : (
              <table className="w-full text-left font-mono text-[12px]">
                <thead className="text-stone-500">
                  <tr>
                    <th className="py-1 font-medium">Time</th>
                    <th className="py-1 font-medium">Type</th>
                    <th className="py-1 font-medium">Debit</th>
                    <th className="py-1 font-medium">Credit</th>
                    <th className="py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map((row) => (
                    <tr key={row.transactionId} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="py-1">{fxPlain(row.timestamp)}</td>
                      <td className="py-1">{fxPlain(row.type)}</td>
                      <td className="py-1">{fxPlain(row.debit)}</td>
                      <td className="py-1">{fxPlain(row.credit)}</td>
                      <td className="py-1">{fxPlain(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
