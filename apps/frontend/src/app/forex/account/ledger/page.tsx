'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import {
  ForexPortalKpiCard,
  ForexPortalModuleCard,
  ForexPortalStatusBadge,
  formatLedgerStatusLabel,
  ledgerStatusTone,
} from '@/components/forex/ForexPortalKpiCard';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { fxMoney, fxPlain } from '@/components/forex/format';
import type { ForexLedgerRow } from '@/lib/forex/models/types';
import { cn } from '@/lib/utils';

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
  const tl = useTranslations('forex.ledgerPage');
  const tc = useTranslations('common.actions');
  const tu = useTranslations('forex.riskStates');
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
  const unavailable = tu('unavailable');

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

  const refShort = (row: ForexLedgerRow) =>
    refField(row.reference, 'fillId') ??
    refField(row.reference, 'orderId') ??
    refField(row.reference, 'positionId') ??
    '—';

  return (
    <ForexPageFrame title={tf('pages.ledger.title')} subtitle={tf('pages.ledger.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/ledger" sectionKey="ledger" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label={tl('summaryAria')}>
            <ForexPortalKpiCard emphasis="primary" label={tl('kpiLedgerBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
            <ForexPortalKpiCard emphasis="secondary" label={tl('kpiEntryCount')} value={rows.length} kind="plain" />
            <ForexPortalKpiCard
              emphasis="secondary"
              label={tl('kpiReconciliation')}
              value={reconciliation?.status ?? tl('kpiReconciliationPending')}
              kind="plain"
            />
            <ForexPortalKpiCard emphasis="secondary" label={tl('kpiCurrency')} value={currency} kind="plain" />
          </section>

          <ForexPortalModuleCard title={tl('filterHeading')}>
            <div className="flex flex-wrap items-end gap-3 text-[12px]">
              <label className="flex min-w-[120px] flex-col gap-1">
                <span className="text-muted-foreground">{tl('filterType')}</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground">{tl('filterFrom')}</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground">{tl('filterTo')}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
          </ForexPortalModuleCard>

          {rows.length === 0 ? (
            <p className="eda-card p-4 text-sm text-muted-foreground">{tl('empty')}</p>
          ) : (
            <>
            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.transactionId} className="eda-card p-3 font-mono text-[11px]">
                  <button type="button" className="w-full text-left" onClick={() => setOpen(row)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-foreground">{new Date(row.timestamp).toLocaleString()}</span>
                      <ForexPortalStatusBadge tone={ledgerStatusTone(row.status)}>{formatLedgerStatusLabel(row.status)}</ForexPortalStatusBadge>
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{fxPlain(row.type)}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">{refShort(row)}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <span className="text-sell/90">{tl('colDebit')}: {fxPlain(cashDebit(row))}</span>
                      <span className="text-buy/90">{tl('colCredit')}: {fxPlain(cashCredit(row))}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="eda-table-wrap hidden md:block">
              <table className="eda-table min-w-[920px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-medium">{tl('colDateTime')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colType')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colReference')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colDebit')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colCredit')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colNet')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colStatus')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colBalanceBefore')}</th>
                    <th className="px-3 py-2 font-medium">{tl('colBalanceAfter')}</th>
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
                      <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground" title={refShort(row)}>
                        {refShort(row)}
                      </td>
                      <td className={cn('px-3 py-2', cashDebit(row) && cashDebit(row) !== '0' && 'text-sell/90')}>{fxPlain(cashDebit(row))}</td>
                      <td className={cn('px-3 py-2', cashCredit(row) && cashCredit(row) !== '0' && 'text-buy/90')}>{fxPlain(cashCredit(row))}</td>
                      <td className="px-3 py-2">{fxPlain(row.net ?? unavailable)}</td>
                      <td className="px-3 py-2">
                        <ForexPortalStatusBadge tone={ledgerStatusTone(row.status)}>{formatLedgerStatusLabel(row.status)}</ForexPortalStatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        {row.balanceBefore != null ? fxMoney(row.balanceBefore, currency) : unavailable}
                      </td>
                      <td className="px-3 py-2">
                        {row.balanceAfter != null ? fxMoney(row.balanceAfter, currency) : unavailable}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {reconciliation ? (
            <section className="eda-card p-4 text-[12px]">
              <p className="font-medium">{tl('reconciliationTitle', { status: reconciliation.status })}</p>
              <p className="mt-1 text-muted-foreground">{tl('reconciliationBody')}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono md:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">{tl('opening')}</dt>
                  <dd>{fxMoney(reconciliation.openingBalance, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('depositsCredits')}</dt>
                  <dd>{fxMoney(reconciliation.deposits, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('withdrawals')}</dt>
                  <dd>{fxMoney(reconciliation.withdrawals, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('realizedPnl')}</dt>
                  <dd>{fxMoney(reconciliation.realizedPnl, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('fees')}</dt>
                  <dd>{fxMoney(reconciliation.fees, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('swaps')}</dt>
                  <dd>{fxMoney(reconciliation.swaps, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('other')}</dt>
                  <dd>{fxMoney(reconciliation.adjustments, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tl('closingBalance')}</dt>
                  <dd>{fxMoney(reconciliation.ledgerBalance, currency)}</dd>
                </div>
              </dl>
              {reconciliation.status === 'MISMATCH' ? (
                <p className="mt-2 text-amber-800 dark:text-amber-300" role="status">
                  {tl('mismatch', {
                    components: fxMoney(reconciliation.ledgerFromComponents, currency),
                    ledger: fxMoney(reconciliation.ledgerBalance, currency),
                  })}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="eda-card border-dashed p-4 text-[12px] text-muted-foreground">
              <p className="font-medium text-foreground">{tl('reconciliationUnavailableTitle')}</p>
              <p className="mt-1">
                {tl('reconciliationUnavailableBody', {
                  balance: fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency),
                })}
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
                {tl('transactionTitle')}
              </h2>
              <button
                type="button"
                className="text-[12px] text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(null)}
              >
                {tc('close')}
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-muted-foreground">{tl('detailWhat')}</dt>
              <dd>{open.type}</dd>
              <dt className="text-muted-foreground">{tl('detailWhen')}</dt>
              <dd>{open.timestamp}</dd>
              <dt className="text-muted-foreground">{tl('colDebit')}</dt>
              <dd>{cashDebit(open)}</dd>
              <dt className="text-muted-foreground">{tl('colCredit')}</dt>
              <dd>{cashCredit(open)}</dd>
              <dt className="text-muted-foreground">{tl('colNet')}</dt>
              <dd>{open.net ?? unavailable}</dd>
              <dt className="text-muted-foreground">{tl('detailWhyStatus')}</dt>
              <dd>{open.status}</dd>
              <dt className="text-muted-foreground">{tl('detailTransactionId')}</dt>
              <dd>{open.transactionId}</dd>
              <dt className="text-muted-foreground">{tl('detailCurrency')}</dt>
              <dd>{open.currency}</dd>
              <dt className="text-muted-foreground">{tl('detailSource')}</dt>
              <dd>{open.source}</dd>
              <dt className="text-muted-foreground">{tl('detailOrder')}</dt>
              <dd>{refField(open.reference, 'orderId') ?? unavailable}</dd>
              <dt className="text-muted-foreground">{tl('detailFill')}</dt>
              <dd>{refField(open.reference, 'fillId') ?? unavailable}</dd>
              <dt className="text-muted-foreground">{tl('detailPosition')}</dt>
              <dd>{refField(open.reference, 'positionId') ?? unavailable}</dd>
              <dt className="text-muted-foreground">{tl('colBalanceBefore')}</dt>
              <dd>{open.balanceBefore != null ? fxMoney(open.balanceBefore, currency) : unavailable}</dd>
              <dt className="text-muted-foreground">{tl('colBalanceAfter')}</dt>
              <dd>{open.balanceAfter != null ? fxMoney(open.balanceAfter, currency) : unavailable}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </ForexPageFrame>
  );
}
