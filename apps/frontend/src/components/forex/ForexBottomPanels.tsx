'use client';

import { useMemo, useState } from 'react';
import { hasForexBearer } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { ForexPositionPanel } from './ForexPositionPanel';
import { fxNum, fxPlain } from './format';

type Tab = 'positions' | 'orders' | 'history' | 'risk';

export function ForexBottomPanels() {
  const [tab, setTab] = useState<Tab>('positions');
  const authed = hasForexBearer();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const ledger = useForexStore((s) => s.ledger);
  const protections = useForexStore((s) => s.protections);
  const margin = useForexStore((s) => s.margin);
  const risk = useForexStore((s) => s.riskStatus);
  const exposure = useForexStore((s) => s.exposure);

  const orderRows = useMemo(() => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [orders]);

  return (
    <section className="flex min-h-[180px] flex-col border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]" aria-label="Positions orders history risk">
      <div className="flex h-8 items-center gap-1 border-b border-stone-200 px-2 dark:border-stone-800" role="tablist">
        {(['positions', 'orders', 'history', 'risk'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-0.5 text-[11px] capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
              tab === t ? 'bg-stone-100 font-medium dark:bg-stone-800' : 'text-stone-500'
            }`}
          >
            {t}
          </button>
        ))}
        {!authed ? <span className="ml-auto text-[11px] text-stone-400">Private panels require a Bearer JWT</span> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
        {tab === 'positions' ? (
          <ForexPositionPanel />
        ) : !authed ? (
          <p className="p-3 text-[12px] text-stone-500">Sign in to view orders, fills, and risk.</p>
        ) : tab === 'orders' ? (
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-stone-500">
              <tr>
                <th className="px-2 py-1 font-medium">Id</th>
                <th className="px-2 py-1 font-medium">Sym</th>
                <th className="px-2 py-1 font-medium">Side</th>
                <th className="px-2 py-1 font-medium">Type</th>
                <th className="px-2 py-1 font-medium">Vol</th>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {orderRows.map((o) => (
                <tr key={o.orderId} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="px-2 py-1">{o.orderId.slice(0, 8)}</td>
                  <td className="px-2 py-1">{o.symbol}</td>
                  <td className="px-2 py-1">{o.side}</td>
                  <td className="px-2 py-1">{o.type}</td>
                  <td className="px-2 py-1">{o.filledVolume}/{o.requestedVolume}</td>
                  <td className="px-2 py-1">{o.status}</td>
                  <td className="px-2 py-1 text-stone-500">{o.failureReason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'history' ? (
          <div className="p-2">
            <p className="mb-1 text-[10px] uppercase text-stone-400">Fills (GET /fills) — not GET /orders history</p>
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="text-stone-500">
                <tr>
                  <th className="px-2 py-1 font-medium">Fill</th>
                  <th className="px-2 py-1 font-medium">Sym</th>
                  <th className="px-2 py-1 font-medium">Side</th>
                  <th className="px-2 py-1 font-medium">Vol</th>
                  <th className="px-2 py-1 font-medium">Price</th>
                  <th className="px-2 py-1 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((f) => (
                  <tr key={f.fillId} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="px-2 py-1">{f.fillId.slice(0, 8)}</td>
                    <td className="px-2 py-1">{f.symbol}</td>
                    <td className="px-2 py-1">{f.side}</td>
                    <td className="px-2 py-1">{f.volume}</td>
                    <td className="px-2 py-1">{f.price}</td>
                    <td className="px-2 py-1">{f.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length ? (
              <p className="mt-2 text-[10px] text-stone-400">{ledger.length} ledger rows from GET /ledger.</p>
            ) : null}
            <p className="mt-1 text-[10px] text-stone-400">{Object.keys(protections).length} protections from GET /protections.</p>
          </div>
        ) : (
          <div className="space-y-1 p-3 font-mono text-[11px]">
            <div>Account risk {fxPlain(risk?.state)} {risk?.reason ? `· ${risk.reason}` : ''}</div>
            <div>Margin class {fxPlain(margin?.status)} · level {fxPlain(margin?.marginLevel)}</div>
            <div>Used {fxNum(margin?.usedMargin, 2)} · Free {fxNum(margin?.freeMargin, 2)}</div>
            <div>Exposure {fxPlain((exposure?.accountNet as string) ?? (exposure?.net as string) ?? margin?.netExposure)}</div>
            <div>Dealing newOrders={String(risk?.dealing.account.newOrderEnabled ?? '—')}</div>
          </div>
        )}
      </div>
    </section>
  );
}
