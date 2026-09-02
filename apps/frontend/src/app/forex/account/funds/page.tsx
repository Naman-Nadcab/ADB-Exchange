'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexMetric } from '@/components/forex/ForexMetric';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxPlain } from '@/components/forex/format';
import { forexApi } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexFundsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const funding = useForexStore((s) => s.funding);
  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ledger = Number(account?.ledgerBalance ?? balance?.ledgerBalance ?? 0);
  const needsDemo = Number.isFinite(ledger) && ledger <= 0;

  async function claimDemo() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await forexApi.claimDemoFunds();
      if (!res.success || !res.data) {
        setError(describeForexError(normalizeForexError(res.error ?? res)));
        return;
      }
      setNote(
        `DEMO credit posted · ${res.data.transaction?.type ?? 'INITIAL_FUNDING'} · SIMULATED / MOCK · not real money`
      );
      await hydrateForexPrivate();
    } catch (e) {
      setError(describeForexError(normalizeForexError(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForexPageFrame
      title="Funds"
      subtitle="FOREX DEMO ACCOUNT · SIMULATED / MOCK. Real Forex deposit rails are OFF. Crypto wallet is separate."
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
        <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Forex Demo</p>
        <h2 className="mt-1 text-lg font-semibold">Claim simulated demo funds</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Credits the isolated Forex ledger only (default $10,000 USD). Does not touch Crypto balances, real deposits, or a
          live LP. REAL FOREX remains OFF · EXECUTION MOCK · SOURCE SIMULATED.
        </p>
        {authed ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void claimDemo()}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Crediting…' : needsDemo ? 'Claim $10,000 Demo Funds' : 'Replay Demo Credit (idempotent)'}
            </button>
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:border-primary/40"
            >
              Open Trade
            </Link>
            <Link href={FOREX_ROUTES.ledger} className="inline-flex min-h-11 items-center px-3 text-sm text-primary hover:underline">
              View Ledger
            </Link>
          </div>
        ) : null}
        {note ? <p className="mt-3 text-sm text-buy">{note}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-sell" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="eda-card p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Real funding rails</p>
        <h2 className="mt-1 text-base font-semibold">Unavailable</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Deposit, withdrawal and transfer to real Forex money are not offered. Demo credits are ledger-only and labelled
          INITIAL_FUNDING / DEMO.
        </p>
      </section>

      {authed ? (
        <section className="eda-card p-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Account activity</h2>
          {funding.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No Forex account activity yet. Claim demo funds to begin.</p>
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
