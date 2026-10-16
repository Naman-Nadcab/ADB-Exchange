'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexHistoryRange } from '@/components/forex/ForexHistoryRange';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { fxPlain } from '@/components/forex/format';
import { forexEnumLabel } from '@/components/forex/forex-enum-label';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { ALL_HISTORY_RANGE, boundsForRange, timestampInBounds, type HistoryRange } from '@/lib/forex/models/history-analytics';
import type { ForexLedgerRow } from '@/lib/forex/models/types';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';

export default function ForexFundingHistoryPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.fundingHistoryPage');
  const te = useTranslations('forex.enums');
  const session = useForexSession();
  const authed = session.authed;
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const [rows, setRows] = useState<ForexLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>(ALL_HISTORY_RANGE);
  const bounds = useMemo(() => boundsForRange(range), [range]);
  const visible = useMemo(() => rows.filter((row) => timestampInBounds(row.timestamp, bounds)), [bounds, rows]);

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
      {session.status === 'AUTHENTICATED' ? (
        <ForexPortalAccountContext />
      ) : (
        <ForexAuthPending status={session.status} href="/login?redirect=/forex/account/funds/history" sectionKey="funds" />
      )}
      <ForexFundsSubNav />
      <ForexPortalModuleCard title={t('tableTitle')} subtitle={t('tableSubtitle')}>
        <div className="mb-3">
          <ForexHistoryRange value={range} onChange={setRange} />
        </div>
        {loading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}
        {err ? <p className="text-sm text-sell">{err}</p> : null}
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
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground">{!loading ? (rows.length > 0 ? tf('dateRange.empty') : t('empty')) : ''}</td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.transactionId}>
                    <td>{fxPlain(row.timestamp)}</td>
                    <td>{forexEnumLabel(te, row.type)}</td>
                    <td className="text-sell/90">{fxPlain(row.cashDebit ?? row.debit)}</td>
                    <td className="text-buy/90">{fxPlain(row.cashCredit ?? row.credit)}</td>
                    <td>{forexEnumLabel(te, row.status)}</td>
                    <td>{fxPlain(row.transactionId)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{t('ledgerNote')}</p>
      </ForexPortalModuleCard>
    </ForexPageFrame>
  );
}
