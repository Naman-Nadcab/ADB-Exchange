'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { forexEnumLabel } from '@/components/forex/forex-enum-label';
import { useForexErrorMessage } from '@/hooks/useForexErrorMessage';
import { ALL_HISTORY_RANGE, boundsForRange, timestampInBounds, type HistoryRange } from '@/lib/forex/models/history-analytics';
import type { ForexOrderState, ForexPublicOrder } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { ForexHistoryRange } from '@/components/forex/ForexHistoryRange';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

const TABS = ['pending', 'open', 'completed', 'cancelled', 'rejected'] as const;
type Tab = (typeof TABS)[number];

const PENDING_STATUSES = new Set([
  'ACCEPTED',
  'PENDING',
  'NEW',
  'TRIGGERING',
  'VALIDATING',
  'CANCEL_PENDING',
  'WORKING',
  'OPEN',
  'PARTIAL',
]);

function classify(status: ForexOrderState): Tab {
  const s = String(status).toUpperCase();
  if (PENDING_STATUSES.has(s) && s !== 'CANCEL_PENDING') return 'pending';
  if (s === 'FILLED' || s === 'PARTIALLY_FILLED') return 'completed';
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'CANCEL_PENDING') return 'cancelled';
  if (s === 'REJECTED' || s === 'FAILED' || s === 'EXPIRED') return 'rejected';
  return 'open';
}

function isCancellable(status: ForexOrderState): boolean {
  return PENDING_STATUSES.has(String(status).toUpperCase()) && String(status).toUpperCase() !== 'CANCEL_PENDING';
}

function orderListed(status: ForexOrderState, createdAt: string, bounds: ReturnType<typeof boundsForRange>): boolean {
  const bucket = classify(status);
  if (bucket === 'pending' || bucket === 'open') return true;
  return timestampInBounds(createdAt, bounds);
}

export default function ForexOrdersPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.ordersPage');
  const to = useTranslations('forex.bottomPanels.orders');
  const te = useTranslations('forex.enums');
  const tc = useTranslations('common.actions');
  const session = useForexSession();
  const orders = useForexStore((s) => s.orders);
  const [tab, setTab] = useState<Tab>('pending');
  const [detail, setDetail] = useState<ForexPublicOrder | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editVol, setEditVol] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>(ALL_HISTORY_RANGE);
  const bounds = useMemo(() => boundsForRange(range), [range]);
  const engine = useForexOrderEngine();
  const engineErrorMsg = useForexErrorMessage(engine.error);

  const rows = useMemo(
    () => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [orders]
  );
  const visible = useMemo(
    () => rows.filter((order) => orderListed(order.status, order.createdAt, bounds)),
    [bounds, rows]
  );
  const filtered = visible.filter((o) => classify(o.status) === tab);
  const tabHasHiddenHistory = useMemo(() => {
    if (tab === 'pending' || tab === 'open') return false;
    return rows.some((order) => classify(order.status) === tab && !timestampInBounds(order.createdAt, bounds));
  }, [bounds, rows, tab]);

  const tabCounts = useMemo(() => {
    const counts = { pending: 0, open: 0, completed: 0, cancelled: 0, rejected: 0 } as Record<Tab, number>;
    for (const o of visible) counts[classify(o.status)] += 1;
    return counts;
  }, [visible]);

  const tabLabel = (key: Tab) => t(`tab.${key}`);

  async function submitEdit(o: ForexPublicOrder) {
    setBusyId(o.orderId);
    try {
      await engine.modify(o.orderId, {
        requestedPrice: editPrice.trim() || undefined,
        volume: editVol.trim() || undefined,
        expectedVersion: o.version,
      });
      setEditId(null);
    } finally {
      setBusyId(null);
    }
  }

  function runCancel(id: string) {
    setBusyId(id);
    setCancelId(null);
    void engine.cancel(id).finally(() => setBusyId(null));
  }

  return (
    <ForexPageFrame
      title={tf('pages.orders.title')}
      subtitle={tf('pages.orders.subtitle')}
    >
      {session.status !== 'AUTHENTICATED' ? (
        <ForexAuthPending status={session.status} href="/login?redirect=/forex/orders" sectionKey="orders" />
      ) : (
        <>
          <ForexPortalAccountContext />
          {engineErrorMsg ? (
            <p className="text-sm text-sell" role="alert">
              {engineErrorMsg}
            </p>
          ) : null}
          {engine.lastNote ? <p className="text-[12px] text-muted-foreground">{engine.lastNote}</p> : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto border-b border-border" role="tablist" aria-label={t('tabsAria')}>
              {TABS.map((key) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(key)}
                    className={cn(
                      'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:h-11',
                      active && 'border-primary text-primary'
                    )}
                  >
                    {tabLabel(key)}
                    <span className={cn('font-mono text-[12px] tabular-nums', active ? 'text-primary' : 'text-muted-foreground')}>
                      {tabCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
            <ForexHistoryRange value={range} onChange={setRange} />
          </div>
          {tab === 'pending' || tab === 'open' ? (
            <p className="text-[12px] text-muted-foreground">{t('rangeLiveNote')}</p>
          ) : null}
          {filtered.length === 0 ? (
            <p className="eda-card p-4 text-sm text-muted-foreground">
              {tabHasHiddenHistory ? tf('dateRange.empty') : t('noOrdersInTab', { tab: tabLabel(tab) })}
            </p>
          ) : (
            <div className="eda-table-wrap overflow-x-auto">
              <table className="eda-table min-w-[960px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 font-medium">{t('colAction')}</th>
                    <th className="px-3 py-2 font-medium">{t('colTime')}</th>
                    <th className="px-3 py-2 font-medium">{t('colSymbol')}</th>
                    <th className="px-3 py-2 font-medium">{t('colSide')}</th>
                    <th className="px-3 py-2 font-medium">{t('colType')}</th>
                    <th className="px-3 py-2 font-medium">{t('colVolume')}</th>
                    <th className="px-3 py-2 font-medium">{t('colPrice')}</th>
                    <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
                    <th className="px-3 py-2 font-medium">{t('colOrderId')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const canAct = isCancellable(o.status);
                    const editing = editId === o.orderId;
                    return (
                      <tr key={o.orderId}>
                        <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2">
                          {canAct ? (
                            editing ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={engine.busy || busyId === o.orderId}
                                  className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary disabled:opacity-50"
                                  onClick={() => void submitEdit(o)}
                                >
                                  {to('save')}
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                                  onClick={() => setEditId(null)}
                                >
                                  {to('abort')}
                                </button>
                              </span>
                            ) : cancelId === o.orderId ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  className="rounded border border-sell/40 px-1.5 py-0.5 text-[10px] text-sell"
                                  onClick={() => runCancel(o.orderId)}
                                  data-testid={`confirm-cancel-${o.orderId.slice(0, 8)}`}
                                >
                                  {to('confirm')}
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                                  onClick={() => setCancelId(null)}
                                >
                                  {to('no')}
                                </button>
                              </span>
                            ) : (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={engine.busy || busyId === o.orderId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 disabled:opacity-50"
                                  onClick={() => {
                                    setEditId(o.orderId);
                                    setEditPrice(o.requestedPrice ?? '');
                                    setEditVol(o.requestedVolume);
                                  }}
                                >
                                  {to('modify')}
                                </button>
                                <button
                                  type="button"
                                  disabled={engine.busy || busyId === o.orderId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-sell/40 hover:text-sell disabled:opacity-50"
                                  onClick={() => setCancelId(o.orderId)}
                                  data-testid={`cancel-order-${o.orderId.slice(0, 8)}`}
                                  aria-label={t('cancelAria', { id: o.orderId.slice(0, 8) })}
                                >
                                  {busyId === o.orderId ? '…' : to('cancel')}
                                </button>
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" className="underline-offset-2 hover:underline" onClick={() => setDetail(o)}>
                            {new Date(o.updatedAt).toLocaleString()}
                          </button>
                        </td>
                        <td className="px-3 py-2">{o.symbol}</td>
                        <td className={cn('px-3 py-2', o.side === 'buy' ? 'text-buy' : 'text-sell')}>{forexEnumLabel(te, o.side)}</td>
                        <td className="px-3 py-2">{forexEnumLabel(te, o.type)}</td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              value={editVol}
                              onChange={(e) => setEditVol(e.target.value)}
                              className="w-16 rounded border border-border bg-background px-1 py-0.5"
                              aria-label={to('modifyVolumeAria')}
                            />
                          ) : (
                            `${o.filledVolume}/${o.requestedVolume}`
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 rounded border border-border bg-background px-1 py-0.5"
                              aria-label={to('modifyPriceAria')}
                            />
                          ) : (
                            o.requestedPrice ?? '—'
                          )}
                        </td>
                        <td className="px-3 py-2">{forexEnumLabel(te, o.status)}</td>
                        <td className="px-3 py-2">{o.orderId.slice(0, 8)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 md:items-center" role="dialog" aria-modal>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex justify-between">
              <h2 className="text-sm font-medium">{t('orderDetailTitle')}</h2>
              <button type="button" className="text-[12px] text-primary underline" onClick={() => setDetail(null)}>
                {tc('close')}
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-muted-foreground">{t('colOrderId')}</dt>
              <dd>{detail.orderId}</dd>
              <dt className="text-muted-foreground">{t('clientOrderId')}</dt>
              <dd>{detail.clientOrderId}</dd>
              <dt className="text-muted-foreground">{t('colStatus')}</dt>
              <dd>{forexEnumLabel(te, detail.status)}</dd>
              <dt className="text-muted-foreground">{t('reason')}</dt>
              <dd>{detail.failureReason ?? '—'}</dd>
              <dt className="text-muted-foreground">{t('executionId')}</dt>
              <dd>{detail.executionId ?? '—'}</dd>
            </dl>
            {isCancellable(detail.status) ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded border border-sell/40 px-2 py-1 text-[12px] text-sell"
                  onClick={() => {
                    runCancel(detail.orderId);
                    setDetail(null);
                  }}
                >
                  {t('cancelOrder')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </ForexPageFrame>
  );
}
