'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { ForexPositionPanel } from './ForexPositionPanel';
import { fxNum, fxPlain } from './format';

type Tab = 'positions' | 'orders' | 'history' | 'risk';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'history', label: 'History' },
  { id: 'risk', label: 'Risk' },
];

export function ForexBottomPanels() {
  const [tab, setTab] = useState<Tab>('positions');
  const authed = hasForexPrivateSession();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const ledger = useForexStore((s) => s.ledger);
  const margin = useForexStore((s) => s.margin);
  const risk = useForexStore((s) => s.riskStatus);
  const exposure = useForexStore((s) => s.exposure);

  const orderRows = useMemo(() => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [orders]);

  return (
    <section className="terminal-panel-subtle flex min-h-[200px] flex-col border-t border-border bg-card" aria-label="Positions orders history risk">
      <div className="flex h-9 items-center gap-1 border-b border-border px-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
        {!authed ? (
          <Link href="/login?redirect=/forex/trade" className="ml-auto text-[11px] text-primary underline-offset-2 hover:underline">
            Sign in for private panels
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
        {tab === 'positions' ? (
          <ForexPositionPanel />
        ) : !authed ? (
          <div className="flex h-full min-h-[120px] flex-col items-start justify-center gap-2 px-4 py-6">
            <p className="text-sm font-medium">Private account data</p>
            <p className="max-w-md text-[12px] text-muted-foreground">
              Sign in to view orders, fills and risk for this Forex account.
            </p>
            <Link href="/login?redirect=/forex/trade" className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
              Sign in
            </Link>
          </div>
        ) : tab === 'orders' ? (
          orderRows.length === 0 ? (
            <p className="p-4 text-[12px] text-muted-foreground">No open orders.</p>
          ) : (
            <table className="w-full text-left font-mono text-[11px] tabular-nums">
              <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Id</th>
                  <th className="px-2 py-1.5 font-medium">Symbol</th>
                  <th className="px-2 py-1.5 font-medium">Side</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                  <th className="px-2 py-1.5 font-medium">Volume</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => (
                  <tr key={o.orderId} className="border-t border-border/80 hover:bg-accent/40">
                    <td className="px-2 py-1.5">{o.orderId.slice(0, 8)}</td>
                    <td className="px-2 py-1.5">{o.symbol}</td>
                    <td className={cn('px-2 py-1.5', o.side === 'buy' ? 'text-buy' : 'text-sell')}>{o.side}</td>
                    <td className="px-2 py-1.5">{o.type}</td>
                    <td className="px-2 py-1.5">
                      {o.filledVolume}/{o.requestedVolume}
                    </td>
                    <td className="px-2 py-1.5">{o.status}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{o.failureReason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === 'history' ? (
          <div className="p-2">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fills</p>
            {fills.length === 0 ? (
              <p className="px-1 py-3 text-[12px] text-muted-foreground">No fills.</p>
            ) : (
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">Fill</th>
                    <th className="px-2 py-1 font-medium">Symbol</th>
                    <th className="px-2 py-1 font-medium">Side</th>
                    <th className="px-2 py-1 font-medium">Volume</th>
                    <th className="px-2 py-1 font-medium">Price</th>
                    <th className="px-2 py-1 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.fillId} className="border-t border-border/80 hover:bg-accent/40">
                      <td className="px-2 py-1.5">{f.fillId.slice(0, 8)}</td>
                      <td className="px-2 py-1.5">{f.symbol}</td>
                      <td className="px-2 py-1.5">{f.side}</td>
                      <td className="px-2 py-1.5">{fxPlain(f.volume)}</td>
                      <td className="px-2 py-1.5">{fxNum(f.price)}</td>
                      <td className="px-2 py-1.5">{new Date(f.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ledger.length ? (
              <p className="mt-2 px-1 text-[10px] text-muted-foreground">{ledger.length} ledger rows available in Account → Ledger.</p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <RiskCard label="Account risk" value={fxPlain(risk?.state)} note={risk?.reason} />
            <RiskCard label="Margin" value={fxPlain(margin?.status)} note={margin?.marginLevel != null ? `Level ${fxPlain(margin.marginLevel)}` : undefined} />
            <RiskCard label="Used / Free" value={`${fxNum(margin?.usedMargin, 2)} / ${fxNum(margin?.freeMargin, 2)}`} />
            <RiskCard
              label="Exposure"
              value={fxPlain((exposure?.accountNet as string) ?? (exposure?.net as string) ?? margin?.netExposure)}
              note={risk?.dealing ? (risk.dealing.account.newOrderEnabled === false ? 'New orders disabled' : 'New orders enabled') : undefined}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function RiskCard(props: { label: string; value: string; note?: string | null }) {
  return (
    <div className="eda-metric !min-w-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{props.label}</p>
      <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{props.value}</p>
      {props.note ? <p className="mt-0.5 text-[10px] text-muted-foreground">{props.note}</p> : null}
    </div>
  );
}
