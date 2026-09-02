'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fxNum, fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import type { ForexOrderState, ForexPublicOrder } from '@/lib/forex/models/types';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

const TABS = ['open', 'pending', 'completed', 'cancelled', 'rejected'] as const;
type Tab = (typeof TABS)[number];

function classify(status: ForexOrderState): Tab {
  if (status === 'PENDING' || status === 'TRIGGERING') return 'pending';
  if (status === 'FILLED' || status === 'PARTIALLY_FILLED') return 'completed';
  if (status === 'CANCELLED' || status === 'CANCEL_PENDING') return 'cancelled';
  if (status === 'REJECTED' || status === 'FAILED') return 'rejected';
  return 'open';
}

export default function ForexOrdersPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const [tab, setTab] = useState<Tab>('open');
  const [detail, setDetail] = useState<ForexPublicOrder | null>(null);
  const rows = useMemo(() => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [orders]);
  const filtered = rows.filter((o) => classify(o.status) === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <p className="text-sm text-muted-foreground">Open, pending and completed Forex orders. Fills are executions, not the order list.</p>
      {!authed ? (
        <p className="eda-card p-4 text-sm text-muted-foreground">
          Sign in to view orders.{' '}
          <Link href="/login?redirect=/forex/orders" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      ) : (
        <>
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
            <p className="text-sm text-muted-foreground">No active Forex orders.</p>
          ) : (
            <div className="eda-table-wrap">
              <table className="eda-table min-w-[860px] font-mono text-[12px]">
                <thead>
                  <tr>
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
                  {filtered.map((o) => (
                    <tr key={o.orderId}>
                      <td className="px-3 py-2">
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => setDetail(o)}>
                          {new Date(o.updatedAt).toLocaleString()}
                        </button>
                      </td>
                      <td className="px-3 py-2">{o.symbol}</td>
                      <td className="px-3 py-2">{o.side}</td>
                      <td className="px-3 py-2">{o.type}</td>
                      <td className="px-3 py-2">
                        {o.filledVolume}/{o.requestedVolume}
                      </td>
                      <td className="px-3 py-2">{o.requestedPrice ?? '—'}</td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2">{o.orderId.slice(0, 8)}</td>
                    </tr>
                  ))}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
