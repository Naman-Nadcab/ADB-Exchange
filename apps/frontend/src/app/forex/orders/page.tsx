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
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Orders</h1>
      <p className="text-[12px] text-stone-500">GET /orders and GET /orders/pending. Fills below are GET /fills, not order history.</p>
      {!authed ? (
        <p className="text-[13px] text-stone-500">
          Sign in to view orders.{' '}
          <Link href="/login?redirect=/forex/orders" className="underline">
            Sign in
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded px-2.5 py-1 text-[12px] capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                  tab === t ? 'bg-stone-200 dark:bg-stone-800' : 'text-stone-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="text-[13px] text-stone-500">No active Forex orders.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]">
              <table className="min-w-[860px] w-full text-left font-mono text-[12px]">
                <thead className="text-stone-500">
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
                    <tr key={o.orderId} className="border-t border-stone-100 dark:border-stone-800">
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

          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Fills / trade history</h2>
            {fills.length === 0 ? (
              <p className="text-[13px] text-stone-500">No Forex executions yet.</p>
            ) : (
              <table className="w-full text-left font-mono text-[12px]">
                <thead className="text-stone-500">
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
                    <tr key={f.fillId} className="border-t border-stone-100 dark:border-stone-800">
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
          <div className="w-full max-w-lg rounded border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-[#101214]">
            <div className="mb-2 flex justify-between">
              <h2 className="text-sm font-medium">Order detail</h2>
              <button type="button" className="text-[12px] underline" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
              <dt className="text-stone-500">Order ID</dt>
              <dd>{detail.orderId}</dd>
              <dt className="text-stone-500">Client order ID</dt>
              <dd>{detail.clientOrderId}</dd>
              <dt className="text-stone-500">Status</dt>
              <dd>{detail.status}</dd>
              <dt className="text-stone-500">Reason</dt>
              <dd>{detail.failureReason ?? '—'}</dd>
              <dt className="text-stone-500">Execution ID</dt>
              <dd>{detail.executionId ?? '—'}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
