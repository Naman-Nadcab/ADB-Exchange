'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { ForexPortalKpiCard, ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { fxNum, fxPlain } from '@/components/forex/format';
import { downloadForexHistoryCsv, forexApi, unwrap } from '@/lib/forex/api/client';
import { closedTradesFromLedger } from '@/lib/forex/models/history-analytics';
import type { ForexLedgerRow } from '@/lib/forex/models/types';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexHistoryPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.historyPage');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const fills = useForexStore((s) => s.fills);
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const [exportBusy, setExportBusy] = useState(false);
  const [closedBusy, setClosedBusy] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [ledger, setLedger] = useState<ForexLedgerRow[]>([]);

  useEffect(() => {
    if (!authed) return;
    void forexApi.ledger().then((raw) => {
      const res = unwrap(raw);
      if (res.ok) setLedger(res.data.transactions ?? []);
    });
  }, [authed, account?.accountId]);

  const closed = useMemo(() => closedTradesFromLedger(ledger), [ledger]);

  const rows = useMemo(
    () => [...fills].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [fills]
  );

  async function onExport() {
    if (exportBusy) return;
    setExportBusy(true);
    setExportErr(null);
    try {
      await downloadForexHistoryCsv('fills');
    } catch {
      setExportErr(t('exportFailed'));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <ForexPageFrame wide title={tf('pages.history.title')} subtitle={tf('pages.history.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/history" sectionKey="portfolio" />
      ) : (
        <>
          <ForexPortalAccountContext />
          <section className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3" aria-label={t('summaryAria')}>
            <ForexPortalKpiCard emphasis="primary" label={t('kpiExecutions')} value={String(rows.length)} kind="plain" />
            <ForexPortalKpiCard emphasis="secondary" label={t('kpiCurrency')} value={currency} kind="plain" />
            <ForexPortalKpiCard emphasis="secondary" label={t('kpiRealizedPnl')} value={account?.realizedPnl} currency={currency} signed />
          </section>

          <ForexPortalModuleCard
            title={t('closedTitle')}
            subtitle={t('closedSubtitle')}
            actions={
              <button
                type="button"
                disabled={closedBusy}
                onClick={() => {
                  setClosedBusy(true);
                  setExportErr(null);
                  void downloadForexHistoryCsv('closed-trades')
                    .catch(() => setExportErr(t('exportFailed')))
                    .finally(() => setClosedBusy(false));
                }}
                className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {closedBusy ? t('exportBusy') : t('exportClosed')}
              </button>
            }
          >
            {closed.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('closedEmpty')}</p>
            ) : (
              <div className="eda-table-wrap overflow-x-auto">
                <table className="eda-table min-w-[720px] font-mono text-[12px]">
                  <thead>
                    <tr>
                      <th>{t('colTime')}</th>
                      <th>{t('colSymbol')}</th>
                      <th>{t('colSide')}</th>
                      <th>{t('colVolume')}</th>
                      <th>{t('colOpen')}</th>
                      <th>{t('colClose')}</th>
                      <th>{t('colProfit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.map((trade) => (
                      <tr key={trade.ticket}>
                        <td>{new Date(trade.timestamp).toLocaleString()}</td>
                        <td>{fxPlain(trade.symbol)}</td>
                        <td>{fxPlain(trade.side)}</td>
                        <td>{fxPlain(trade.volume)}</td>
                        <td>{fxNum(trade.openPrice)}</td>
                        <td>{fxNum(trade.closePrice)}</td>
                        <td>{fxNum(trade.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ForexPortalModuleCard>

          <ForexPortalModuleCard
            title={t('tableTitle')}
            actions={
              <button
                type="button"
                disabled={exportBusy || rows.length === 0}
                onClick={() => void onExport()}
                className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {exportBusy ? t('exportBusy') : t('exportCsv')}
              </button>
            }
          >
            {exportErr ? (
              <p className="mb-2 text-sm text-sell" role="alert">
                {exportErr}
              </p>
            ) : null}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <div className="eda-table-wrap overflow-x-auto">
                <table className="eda-table min-w-[720px] font-mono text-[12px]">
                  <thead>
                    <tr>
                      <th>{t('colTime')}</th>
                      <th>{t('colSymbol')}</th>
                      <th>{t('colSide')}</th>
                      <th>{t('colVolume')}</th>
                      <th>{t('colPrice')}</th>
                      <th>{t('colFillId')}</th>
                      <th>{t('colOrderId')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.fillId}>
                        <td>{new Date(f.timestamp).toLocaleString()}</td>
                        <td>{fxPlain(f.symbol)}</td>
                        <td>{fxPlain(f.side)}</td>
                        <td>{fxPlain(f.volume)}</td>
                        <td>{fxNum(f.price)}</td>
                        <td>{f.fillId.slice(0, 10)}</td>
                        <td>{f.orderId.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">{t('statementNote')}</p>
          </ForexPortalModuleCard>
        </>
      )}
    </ForexPageFrame>
  );
}
