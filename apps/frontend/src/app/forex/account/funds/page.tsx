'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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
  const tf = useTranslations('forex');
  const t = useTranslations('forex.fundsPage');
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
        t('demoCreditNote', {
          type: res.data.transaction?.type ?? 'INITIAL_FUNDING',
        })
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
      title={tf('pages.funds.title')}
      subtitle={tf('pages.funds.subtitle')}
    >
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/funds" sectionKey="funds" />
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ForexMetric label={t('metricAvailableBalance')} value={account?.availableBalance ?? balance?.availableBalance} currency={currency} />
          <ForexMetric label={t('metricLedgerBalance')} value={account?.ledgerBalance ?? balance?.ledgerBalance} currency={currency} />
          <ForexMetric label={t('metricEquity')} value={account?.equity ?? balance?.equity} currency={currency} />
          <ForexMetric label={t('metricUsedMargin')} value={account?.usedMargin} currency={currency} />
        </section>
      )}

      <section className="eda-card-featured p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('demoBadge')}</p>
        <h2 className="mt-1 text-lg font-semibold">{t('demoTitle')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('demoBody')}</p>
        {authed ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {needsDemo ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void claimDemo()}
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? t('claimBusy') : t('claimButton')}
              </button>
            ) : (
              <p className="rounded-lg border border-buy/40 bg-buy/10 px-4 py-2 text-sm text-buy">
                {t('fundedNotice', {
                  balance: fxPlain(account?.ledgerBalance ?? balance?.ledgerBalance),
                  currency,
                })}
              </p>
            )}
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:border-primary/40"
            >
              {t('openTrade')}
            </Link>
            <Link href={FOREX_ROUTES.ledger} className="inline-flex min-h-11 items-center px-3 text-sm text-primary hover:underline">
              {t('viewLedger')}
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
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('realRailsBadge')}</p>
        <h2 className="mt-1 text-base font-semibold">{t('realRailsTitle')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('realRailsBody')}</p>
      </section>

      {authed ? (
        <section className="eda-card p-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t('activityHeading')}</h2>
          {funding.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('activityEmpty')}</p>
          ) : (
            <div className="eda-table-wrap mt-3">
              <table className="eda-table font-mono text-[12px]">
                <thead>
                  <tr>
                    <th>{t('colTime')}</th>
                    <th>{t('colType')}</th>
                    <th>{t('colDebit')}</th>
                    <th>{t('colCredit')}</th>
                    <th>{t('colStatus')}</th>
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
