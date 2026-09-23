'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CircleDollarSign, Landmark, Wallet } from 'lucide-react';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
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
    <ForexPageFrame title={tf('pages.funds.title')} subtitle={tf('pages.funds.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/funds" sectionKey="funds" />
      ) : (
        <>
          <ForexPortalAccountContext />
          <ForexFundsSubNav />
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label={t('summaryAria')}>
          <ForexPortalKpiCard
            emphasis="primary"
            icon={Wallet}
            label={t('metricAvailableBalance')}
            value={account?.availableBalance ?? balance?.availableBalance}
            currency={currency}
          />
          <ForexPortalKpiCard
            emphasis="primary"
            icon={Landmark}
            label={t('metricLedgerBalance')}
            value={account?.ledgerBalance ?? balance?.ledgerBalance}
            currency={currency}
          />
          <ForexPortalKpiCard
            emphasis="primary"
            icon={CircleDollarSign}
            label={t('metricEquity')}
            value={account?.equity ?? balance?.equity}
            currency={currency}
          />
          <ForexPortalKpiCard
            emphasis="secondary"
            label={t('metricUsedMargin')}
            value={account?.usedMargin}
            currency={currency}
          />
        </section>
        </>
      )}

      <ForexPortalModuleCard title={t('demoTitle')} accent subtitle={t('demoBadge')}>
        <p className="max-w-2xl text-sm text-foreground">{t('demoBodyShort')}</p>
        <details className="mt-3 rounded border border-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{t('technicalDetailsLabel')}</summary>
          <p className="mt-2 leading-relaxed">{t('demoBody')}</p>
        </details>
        {authed ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {needsDemo ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void claimDemo()}
                className="inline-flex min-h-10 items-center rounded border border-primary/45 bg-primary/15 px-4 text-[12px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {busy ? t('claimBusy') : t('claimButton')}
              </button>
            ) : (
              <p className="rounded border border-buy/40 bg-buy/10 px-3 py-2 text-sm text-buy">
                {t('fundedNoticeShort', {
                  balance: fxPlain(account?.ledgerBalance ?? balance?.ledgerBalance),
                  currency,
                })}
              </p>
            )}
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold hover:border-primary/40"
            >
              {t('openTrade')}
            </Link>
            <Link href={FOREX_ROUTES.ledger} className="inline-flex min-h-10 items-center px-3 text-[12px] text-primary hover:underline">
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
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title={t('realRailsTitle')} subtitle={t('realRailsBadge')}>
        <ForexPortalStatusBadge tone="warning">{t('realRailsUnavailableBadge')}</ForexPortalStatusBadge>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t('realRailsBodyShort')}</p>
        <details className="mt-3 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer text-foreground">{t('technicalDetailsLabel')}</summary>
          <p className="mt-2">{t('realRailsBody')}</p>
        </details>
      </ForexPortalModuleCard>

      {authed ? (
        <ForexPortalModuleCard title={t('activityHeading')}>
          {funding.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('activityEmpty')}</p>
          ) : (
            <div className="eda-table-wrap -mx-1">
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
                      <td className="text-sell/90">{fxPlain(row.cashDebit ?? row.debit)}</td>
                      <td className="text-buy/90">{fxPlain(row.cashCredit ?? row.credit)}</td>
                      <td>{fxPlain(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ForexPortalModuleCard>
      ) : null}
    </ForexPageFrame>
  );
}
