'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { fxPlain } from '@/components/forex/format';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import type { ForexLedgerRow } from '@/lib/forex/models/types';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexFundingHistoryPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.fundingHistoryPage');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const [rows, setRows] = useState<ForexLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authed || !activeId) return;
    setLoading(true);
    setErr(null);
    const res = unwrap(await forexApi.getAccountFundingHistory(activeId));
    if (!res.ok) {
      setErr(res.error.message);
      setRows([]);
    } else {
      setRows(res.data.transactions);
    }
    setLoading(false);
  }, [activeId, authed]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ForexPageFrame title={tf('pages.fundsHistory.title')} subtitle={tf('pages.fundsHistory.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account/funds/history" sectionKey="funds" />
      ) : (
        <>
          <ForexPortalAccountContext />
          <ForexFundsSubNav />
          <ForexPortalModuleCard title={t('tableTitle')} subtitle={t('tableSubtitle')}>
            {loading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}
            {err ? <p className="text-sm text-sell">{err}</p> : null}
            {!loading && !err && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : null}
            {rows.length > 0 ? (
              <div className="eda-table-wrap overflow-x-auto">
                <table className="eda-table min-w-[720px] font-mono text-[12px]">
                  <thead>
                    <tr>
                      <th>{t('colTime')}</th>
                      <th>{t('colType')}</th>
                      <th>{t('colDebit')}</th>
                      <th>{t('colCredit')}</th>
                      <th>{t('colStatus')}</th>
                      <th>{t('colReference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.transactionId}>
                        <td>{fxPlain(row.timestamp)}</td>
                        <td>{fxPlain(row.type)}</td>
                        <td className="text-sell/90">{fxPlain(row.cashDebit ?? row.debit)}</td>
                        <td className="text-buy/90">{fxPlain(row.cashCredit ?? row.credit)}</td>
                        <td>{fxPlain(row.status)}</td>
                        <td>{fxPlain(row.transactionId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">{t('ledgerNote')}</p>
          </ForexPortalModuleCard>
        </>
      )}
    </ForexPageFrame>
  );
}
