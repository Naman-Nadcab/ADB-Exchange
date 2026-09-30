'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fxNum, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError } from '@/lib/forex/models/errors';
import type { ForexOrderState, ForexPublicOrder } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

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

export default function ForexOrdersPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const [tab, setTab] = useState<Tab>('pending');
  const [detail, setDetail] = useState<ForexPublicOrder | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editVol, setEditVol] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const engine = useForexOrderEngine();

  const rows = useMemo(() => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [orders]);
  const filtered = rows.filter((o) => classify(o.status) === tab);

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
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Open, pending and completed Forex orders. Pending rows expose Modify and Cancel (server-authoritative).
      </p>
      {!authed ? (
        <p className="eda-card p-4 text-sm text-muted-foreground">
          Sign in to view orders.{' '}
          <Link href="/login?redirect=/forex/orders" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      ) : (
        <>
          {engine.error ? (
            <p className="text-sm text-sell" role="alert">
              {describeForexError(engine.error)}
            </p>
          ) : null}
          {engine.lastNote ? <p className="text-[12px] text-muted-foreground">{engine.lastNote}</p> : null}
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`eda-tab capitalize ${tab === t ? 'eda-tab-active' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {tab} Forex orders.</p>
          ) : (
            <div className="eda-table-wrap overflow-x-auto">
              <table className="eda-table min-w-[960px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Volume</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const canAct = isCancellable(o.status);
                    const editing = editId === o.orderId;
                    return (
                      <tr key={o.orderId}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2">
                          {canAct ? (
                            editing ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={engine.busy || busyId === o.orderId}
                                  className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary disabled:opacity-50"
                                  onClick={() => void submitEdit(o)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                                  onClick={() => setEditId(null)}
                                >
                                  Abort
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
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                                  onClick={() => setCancelId(null)}
                                >
                                  No
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
                                  Modify
                                </button>
                                <button
                                  type="button"
                                  disabled={engine.busy || busyId === o.orderId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-sell/40 hover:text-sell disabled:opacity-50"
                                  onClick={() => setCancelId(o.orderId)}
                                  data-testid={`cancel-order-${o.orderId.slice(0, 8)}`}
                                  aria-label={`Cancel order ${o.orderId.slice(0, 8)}`}
                                >
                                  {busyId === o.orderId ? '…' : 'Cancel'}
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
                        <td className={cn('px-3 py-2', o.side === 'buy' ? 'text-buy' : 'text-sell')}>{o.side}</td>
                        <td className="px-3 py-2">{o.type}</td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              value={editVol}
                              onChange={(e) => setEditVol(e.target.value)}
                              className="w-16 rounded border border-border bg-background px-1 py-0.5"
                              aria-label="Modify volume"
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
                              aria-label="Modify price"
                            />
                          ) : (
                            o.requestedPrice ?? '—'
                          )}
                        </td>
                        <td className="px-3 py-2">{o.status}</td>
                        <td className="px-3 py-2">{o.orderId.slice(0, 8)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <section className="eda-card p-4">
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Fills</h2>
            {fills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Forex executions yet.</p>
            ) : (
              <table className="eda-table font-mono text-[12px]">
                <thead>
                  <tr>
                    <th className="py-1 font-medium">Time</th>
                    <th className="py-1 font-medium">Symbol</th>
                    <th className="py-1 font-medium">Side</th>
                    <th className="py-1 font-medium">Volume</th>
                    <th className="py-1 font-medium">Price</th>
                    <th className="py-1 font-medium">Fill ID</th>
                    <th className="py-1 font-medium">Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.fillId}>
                      <td className="py-1">{new Date(f.timestamp).toLocaleString()}</td>
                      <td className="py-1">{f.symbol}</td>
                      <td className="py-1">{f.side}</td>
                      <td className="py-1">{fxPlain(f.volume)}</td>
                      <td className="py-1">{fxNum(f.price)}</td>
                      <td className="py-1">{f.fillId.slice(0, 8)}</td>
                      <td className="py-1">{f.orderId.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 md:items-center" role="dialog" aria-modal>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex justify-between">
              <h2 className="text-sm font-medium">Order detail</h2>
              <button type="button" className="text-[12px] text-primary underline" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-muted-foreground">Order ID</dt>
              <dd>{detail.orderId}</dd>
              <dt className="text-muted-foreground">Client order ID</dt>
              <dd>{detail.clientOrderId}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{detail.status}</dd>
              <dt className="text-muted-foreground">Reason</dt>
              <dd>{detail.failureReason ?? '—'}</dd>
              <dt className="text-muted-foreground">Execution ID</dt>
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
                  Cancel order
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
