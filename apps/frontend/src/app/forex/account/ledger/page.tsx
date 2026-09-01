'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { fxMoney, fxPlain } from '@/components/forex/format';
import type { ForexLedgerRow } from '@/lib/forex/models/types';

function refField(ref: unknown, key: string): string | null {
  if (!ref || typeof ref !== 'object') return null;
  const v = (ref as Record<string, unknown>)[key];
  return v == null ? null : String(v);
}

export default function ForexLedgerPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const ledger = useForexStore((s) => s.ledger);
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const [open, setOpen] = useState<ForexLedgerRow | null>(null);
  const rows = useMemo(() => [...ledger].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [ledger]);
  const currency = account?.currency ?? balance?.currency ?? 'USD';

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Ledger</h1>
          <p className="text-[12px] text-stone-500">GET /api/v1/forex/ledger. Frontend does not compute balance-after.</p>
        </div>
        <ForexAccountNav />
      </div>

      {!authed ? (
        <p className="text-[13px] text-stone-500">
          Sign in to view the ledger.{' '}
          <Link href="/login?redirect=/forex/account/ledger" className="underline">
            Sign in
          </Link>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-stone-500">No Forex account activity.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]">
          <table className="min-w-[720px] w-full text-left font-mono text-[12px]">
            <thead className="text-[11px] uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date/time</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Debit</th>
                <th className="px-3 py-2 font-medium">Credit</th>
                <th className="px-3 py-2 font-medium">Currency</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.transactionId} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="px-3 py-2">
                    <button type="button" className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400" onClick={() => setOpen(row)}>
                      {new Date(row.timestamp).toLocaleString()}
                    </button>
                  </td>
                  <td className="px-3 py-2">{fxPlain(row.type)}</td>
                  <td className="px-3 py-2">{refField(row.reference, 'fillId') ?? refField(row.reference, 'orderId') ?? '—'}</td>
                  <td className="px-3 py-2">{fxPlain(row.debit)}</td>
                  <td className="px-3 py-2">{fxPlain(row.credit)}</td>
                  <td className="px-3 py-2">{fxPlain(row.currency)}</td>
                  <td className="px-3 py-2">{fxPlain(row.status)}</td>
                  <td className="px-3 py-2 text-stone-400">Unavailable</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded border border-dashed border-stone-300 p-3 text-[12px] text-stone-500 dark:border-stone-700">
        <p className="font-medium text-stone-600 dark:text-stone-300">Detailed reconciliation unavailable</p>
        <p className="mt-1">
          Public ledger rows do not include opening balance or balance-after. Current ledger balance is {fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency)} from GET /account.
        </p>
      </section>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 md:items-center" role="dialog" aria-modal aria-labelledby="ledger-detail-title">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-[#101214]">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="ledger-detail-title" className="text-sm font-medium">
                Transaction
              </h2>
              <button type="button" className="text-[12px] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-stone-500">Transaction ID</dt>
              <dd>{open.transactionId}</dd>
              <dt className="text-stone-500">Timestamp</dt>
              <dd>{open.timestamp}</dd>
              <dt className="text-stone-500">Type</dt>
              <dd>{open.type}</dd>
              <dt className="text-stone-500">Status</dt>
              <dd>{open.status}</dd>
              <dt className="text-stone-500">Debit</dt>
              <dd>{open.debit}</dd>
              <dt className="text-stone-500">Credit</dt>
              <dd>{open.credit}</dd>
              <dt className="text-stone-500">Currency</dt>
              <dd>{open.currency}</dd>
              <dt className="text-stone-500">Source</dt>
              <dd>{open.source}</dd>
              <dt className="text-stone-500">Order ID</dt>
              <dd>{refField(open.reference, 'orderId') ?? 'Unavailable'}</dd>
              <dt className="text-stone-500">Fill ID</dt>
              <dd>{refField(open.reference, 'fillId') ?? 'Unavailable'}</dd>
              <dt className="text-stone-500">Position ID</dt>
              <dd>{refField(open.reference, 'positionId') ?? 'Unavailable'}</dd>
              <dt className="text-stone-500">Balance after</dt>
              <dd>Unavailable</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
