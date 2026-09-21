'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
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

function cashDebit(row: ForexLedgerRow): string {
  return row.cashDebit ?? row.debit;
}

function cashCredit(row: ForexLedgerRow): string {
  return row.cashCredit ?? row.credit;
}

export default function ForexLedgerPage() {
  const tf = useTranslations('forex');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const ledger = useForexStore((s) => s.ledger);
  const reconciliation = useForexStore((s) => s.ledgerReconciliation);
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const [open, setOpen] = useState<ForexLedgerRow | null>(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const currency = account?.currency ?? balance?.currency ?? reconciliation?.currency ?? 'USD';

  const types = useMemo(() => {
    const set = new Set(ledger.map((r) => r.type));
    return ['ALL', ...Array.from(set).sort()];
  }, [ledger]);

  const rows = useMemo(() => {
    const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00.000Z`) : NaN;
    const toMs = toDate ? Date.parse(`${toDate}T23:59:59.999Z`) : NaN;
    return [...ledger]
      .filter((row) => (typeFilter === 'ALL' ? true : row.type === typeFilter))
      .filter((row) => {
        const ms = Date.parse(row.timestamp);
        if (Number.isFinite(fromMs) && ms < fromMs) return false;
        if (Number.isFinite(toMs) && ms > toMs) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [ledger, typeFilter, fromDate, toDate]);

  return (
    <ForexPageFrame
      title={tf('pages.ledger.title')}
      subtitle={tf('pages.ledger.subtitle')}
      actions={<ForexAccountNav />}
    >
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/ledger" sectionKey="ledger" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 text-[12px]">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Forex account activity.</p>
          ) : (
            <div className="eda-table-wrap">
              <table className="eda-table min-w-[920px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-medium">Date/time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Debit</th>
                    <th className="px-3 py-2 font-medium">Credit</th>
                    <th className="px-3 py-2 font-medium">Net</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Balance before</th>
                    <th className="px-3 py-2 font-medium">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.transactionId}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setOpen(row)}
                        >
                          {new Date(row.timestamp).toLocaleString()}
                        </button>
                      </td>
                      <td className="px-3 py-2">{fxPlain(row.type)}</td>
                      <td className="px-3 py-2">
                        {refField(row.reference, 'fillId') ??
                          refField(row.reference, 'orderId') ??
                          refField(row.reference, 'positionId') ??
                          '—'}
                      </td>
                      <td className="px-3 py-2">{fxPlain(cashDebit(row))}</td>
                      <td className="px-3 py-2">{fxPlain(cashCredit(row))}</td>
                      <td className="px-3 py-2">{fxPlain(row.net ?? 'Unavailable')}</td>
                      <td className="px-3 py-2">{fxPlain(row.status)}</td>
                      <td className="px-3 py-2">
                        {row.balanceBefore != null ? fxMoney(row.balanceBefore, currency) : 'Unavailable'}
                      </td>
                      <td className="px-3 py-2">
                        {row.balanceAfter != null ? fxMoney(row.balanceAfter, currency) : 'Unavailable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reconciliation ? (
            <section className="eda-card p-4 text-[12px]">
              <p className="font-medium">
                Ledger reconciliation · {reconciliation.status}
              </p>
              <p className="mt-1 text-muted-foreground">
                Opening, credits, debits and closing balance come from the Forex ledger service.
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono md:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Opening</dt>
                  <dd>{fxMoney(reconciliation.openingBalance, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Deposits / credits</dt>
                  <dd>{fxMoney(reconciliation.deposits, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Withdrawals</dt>
                  <dd>{fxMoney(reconciliation.withdrawals, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Realized P&amp;L</dt>
                  <dd>{fxMoney(reconciliation.realizedPnl, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fees</dt>
                  <dd>{fxMoney(reconciliation.fees, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Swaps</dt>
                  <dd>{fxMoney(reconciliation.swaps, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Other</dt>
                  <dd>{fxMoney(reconciliation.adjustments, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Closing / ledger balance</dt>
                  <dd>{fxMoney(reconciliation.ledgerBalance, currency)}</dd>
                </div>
              </dl>
              {reconciliation.status === 'MISMATCH' ? (
                <p className="mt-2 text-amber-800 dark:text-amber-300" role="status">
                  Components {fxMoney(reconciliation.ledgerFromComponents, currency)} do not match ledger balance{' '}
                  {fxMoney(reconciliation.ledgerBalance, currency)}.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="eda-card border-dashed p-4 text-[12px] text-muted-foreground">
              <p className="font-medium text-foreground">Detailed reconciliation unavailable</p>
              <p className="mt-1">
                Current ledger balance is {fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency)} from GET
                /account.
              </p>
            </section>
          )}
        </>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 md:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="ledger-detail-title"
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="ledger-detail-title" className="text-sm font-medium">
                Transaction
              </h2>
              <button
                type="button"
                className="text-[12px] text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(null)}
              >
                Close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-muted-foreground">What</dt>
              <dd>{open.type}</dd>
              <dt className="text-muted-foreground">When</dt>
              <dd>{open.timestamp}</dd>
              <dt className="text-muted-foreground">Debit</dt>
              <dd>{cashDebit(open)}</dd>
              <dt className="text-muted-foreground">Credit</dt>
              <dd>{cashCredit(open)}</dd>
              <dt className="text-muted-foreground">Net</dt>
              <dd>{open.net ?? 'Unavailable'}</dd>
              <dt className="text-muted-foreground">Why / status</dt>
              <dd>{open.status}</dd>
              <dt className="text-muted-foreground">Transaction ID</dt>
              <dd>{open.transactionId}</dd>
              <dt className="text-muted-foreground">Currency</dt>
              <dd>{open.currency}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{open.source}</dd>
              <dt className="text-muted-foreground">Order</dt>
              <dd>{refField(open.reference, 'orderId') ?? 'Unavailable'}</dd>
              <dt className="text-muted-foreground">Fill</dt>
              <dd>{refField(open.reference, 'fillId') ?? 'Unavailable'}</dd>
              <dt className="text-muted-foreground">Position</dt>
              <dd>{refField(open.reference, 'positionId') ?? 'Unavailable'}</dd>
              <dt className="text-muted-foreground">Balance before</dt>
              <dd>{open.balanceBefore != null ? fxMoney(open.balanceBefore, currency) : 'Unavailable'}</dd>
              <dt className="text-muted-foreground">Balance after</dt>
              <dd>{open.balanceAfter != null ? fxMoney(open.balanceAfter, currency) : 'Unavailable'}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </ForexPageFrame>
  );
}
