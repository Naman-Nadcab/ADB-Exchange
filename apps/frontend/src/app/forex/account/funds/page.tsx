'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CircleDollarSign, Landmark, Wallet } from 'lucide-react';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexHistoryRange } from '@/components/forex/ForexHistoryRange';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { fxPlain } from '@/components/forex/format';
import { forexEnumLabel } from '@/components/forex/forex-enum-label';
import { forexApi } from '@/lib/forex/api/client';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { ALL_HISTORY_RANGE, boundsForRange, timestampInBounds, type HistoryRange } from '@/lib/forex/models/history-analytics';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';

export default function ForexFundsPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.fundsPage');
  const te = useTranslations('forex.enums');
  const session = useForexSession();
  const authed = session.authed;
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const funding = useForexStore((s) => s.funding);
  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>(ALL_HISTORY_RANGE);
  const activity = useMemo(
    () => funding.filter((row) => timestampInBounds(row.timestamp, boundsForRange(range))),
    [funding, range]
  );
  const activityPreview = activity.slice(0, 5);

  const { gates } = useForexProductGates();
  const railsOn = gates.realFundingEnabled || gates.withdrawalEnabled;
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
          type: forexEnumLabel(te, res.data.transaction?.type ?? 'INITIAL_FUNDING'),
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
      {session.status === 'AUTHENTICATED' ? (
        <ForexPortalAccountContext />
      ) : (
        <ForexAuthPending status={session.status} href="/login?redirect=/forex/account/funds" sectionKey="funds" />
      )}
      <ForexFundsSubNav />
      {authed ? (
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label={t('summaryAria')}>
          <ForexPortalKpiCard
            tone="brand"
            emphasis="primary"
            icon={Wallet}
            label={t('metricAvailableBalance')}
            value={account?.availableBalance ?? balance?.availableBalance}
            currency={currency}
          />
          <ForexPortalKpiCard
            tone="neutral"
            emphasis="primary"
            icon={Landmark}
            label={t('metricLedgerBalance')}
            value={account?.ledgerBalance ?? balance?.ledgerBalance}
            currency={currency}
          />
          <ForexPortalKpiCard
            tone="neutral"
            emphasis="primary"
            icon={CircleDollarSign}
            label={t('metricEquity')}
            value={account?.equity ?? balance?.equity}
            currency={currency}
          />
          <ForexPortalKpiCard
            tone="warning"
            emphasis="secondary"
            label={t('metricUsedMargin')}
            value={account?.usedMargin}
            currency={currency}
          />
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
      <ForexPortalModuleCard title={t('demoTitle')} accent subtitle={t('demoBadge')}>
        <p className="max-w-2xl text-sm text-foreground">{t('demoBodyShort')}</p>
        <details className="mt-3 rounded border border-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{t('technicalDetailsLabel')}</summary>
          <p className="mt-2 leading-relaxed">{t('demoBody')}</p>
        </details>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {authed && !needsDemo ? (
            <p className="rounded border border-buy/40 bg-buy/10 px-3 py-2 text-sm text-buy">
              {t('fundedNoticeShort', {
                balance: fxPlain(account?.ledgerBalance ?? balance?.ledgerBalance),
                currency,
              })}
            </p>
          ) : (
            <button
              type="button"
              disabled={!authed || busy}
              onClick={() => void claimDemo()}
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? t('claimBusy') : t('claimButton')}
            </button>
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
        {note ? <p className="mt-3 text-sm text-buy">{note}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-sell" role="alert">
            {error}
          </p>
        ) : null}
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title={railsOn ? t('realRailsOnTitle') : t('realRailsTitle')} subtitle={t('realRailsBadge')}>
        <ForexPortalStatusBadge tone={railsOn ? 'success' : 'warning'}>
          {railsOn ? t('realRailsOnBadge') : t('realRailsUnavailableBadge')}
        </ForexPortalStatusBadge>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{railsOn ? t('realRailsOnBody') : t('realRailsBodyShort')}</p>
        {railsOn ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {gates.realFundingEnabled ? (
              <Link href={FOREX_ROUTES.fundsDeposit} className="inline-flex min-h-10 items-center rounded border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary">
                {t('goDeposit')}
              </Link>
            ) : null}
            {gates.withdrawalEnabled ? (
              <Link href={FOREX_ROUTES.fundsWithdraw} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goWithdraw')}
              </Link>
            ) : null}
            {gates.paymentMethodsEnabled ? (
              <Link href={FOREX_ROUTES.fundsPaymentMethods} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goPaymentMethods')}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-muted-foreground">{t('workflowLead')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={FOREX_ROUTES.fundsDeposit} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goDeposit')}
              </Link>
              <Link href={FOREX_ROUTES.fundsWithdraw} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goWithdraw')}
              </Link>
              <Link href={FOREX_ROUTES.fundsTransfer} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goTransfer')}
              </Link>
              <Link href={FOREX_ROUTES.fundsPaymentMethods} className="inline-flex min-h-10 items-center rounded border border-border px-4 text-[12px] font-semibold">
                {t('goPaymentMethods')}
              </Link>
            </div>
            <details className="mt-3 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer text-foreground">{t('technicalDetailsLabel')}</summary>
              <p className="mt-2">{t('realRailsBody')}</p>
            </details>
          </>
        )}
      </ForexPortalModuleCard>
      </div>

      {authed ? (
        <ForexPortalModuleCard title={t('activityHeading')}>
          <div className="mb-3">
            <ForexHistoryRange value={range} onChange={setRange} />
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{funding.length > 0 ? tf('dateRange.empty') : t('activityEmpty')}</p>
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
                  {activityPreview.map((row) => (
                    <tr key={row.transactionId}>
                      <td>{fxPlain(row.timestamp)}</td>
                      <td>{forexEnumLabel(te, row.type)}</td>
                      <td className="text-sell/90">{fxPlain(row.cashDebit ?? row.debit)}</td>
                      <td className="text-buy/90">{fxPlain(row.cashCredit ?? row.credit)}</td>
                      <td>{forexEnumLabel(te, row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activity.length > 5 ? (
            <Link href={FOREX_ROUTES.fundsHistory} className="mt-3 inline-flex text-[13px] font-medium text-primary underline-offset-2 hover:underline">
              {tf('pages.fundsHistory.title')}
            </Link>
          ) : null}
        </ForexPortalModuleCard>
      ) : null}
    </ForexPageFrame>
  );
}
