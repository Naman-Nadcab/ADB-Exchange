'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError } from '@/lib/forex/models/errors';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexPositionPanel } from './ForexPositionPanel';
import { fxNum, fxPlain } from './format';

type Tab = 'positions' | 'orders' | 'history' | 'risk' | 'dom';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'positions', label: 'Trade' },
  { id: 'orders', label: 'Orders' },
  { id: 'history', label: 'Deals' },
  { id: 'risk', label: 'Exposure' },
  { id: 'dom', label: 'DOM' },
];

const PENDING_STATUSES = new Set(['ACCEPTED', 'PENDING', 'NEW', 'TRIGGERING', 'VALIDATING', 'CANCEL_PENDING']);

export function ForexBottomPanels(props: { compact?: boolean; hasTradingData?: boolean }) {
  const [tab, setTab] = useState<Tab>('positions');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const authed = hasForexPrivateSession();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const ledger = useForexStore((s) => s.ledger);
  const margin = useForexStore((s) => s.margin);
  const risk = useForexStore((s) => s.riskStatus);
  const exposure = useForexStore((s) => s.exposure);
  const bottomCollapsed = useForexWorkspaceStore((s) => s.bottomCollapsed);
  const toggleBottomCollapsed = useForexWorkspaceStore((s) => s.toggleBottomCollapsed);
  const setBottomCollapsed = useForexWorkspaceStore((s) => s.setBottomCollapsed);
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const engine = useForexOrderEngine();

  const orderRows = useMemo(
    () => Object.values(orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [orders]
  );
  const compact = Boolean(props.compact) || bottomCollapsed || chartMode === 'expand';

  return (
    <section
      className="terminal-panel-subtle flex h-full min-h-0 flex-col border-t border-border bg-card"
      aria-label="Positions orders history risk"
    >
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (compact) setBottomCollapsed(false);
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-2 hidden text-[10px] text-muted-foreground sm:inline">
          {props.hasTradingData ? 'Active' : 'No open activity'}
        </span>
        {!authed ? (
          <Link
            href="/login?redirect=/forex/trade"
            className="ml-auto text-[11px] text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        ) : (
          <button
            type="button"
            className="ml-auto rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => toggleBottomCollapsed()}
            aria-pressed={compact}
          >
            {compact ? 'Expand' : 'Collapse'}
          </button>
        )}
      </div>

      {!compact ? (
        <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
          {tab === 'positions' ? (
            <ForexPositionPanel />
          ) : !authed ? (
            <div className="flex flex-col items-start justify-center gap-1.5 px-4 py-4">
              <p className="text-[12px] font-medium">Private account data</p>
              <p className="max-w-md text-[11px] text-muted-foreground">
                Sign in to view orders, fills and risk for this Forex account.
              </p>
            </div>
          ) : tab === 'orders' ? (
            orderRows.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-muted-foreground">No orders.</p>
            ) : (
              <div>
                {engine.error ? (
                  <p className="px-3 py-1.5 text-[11px] text-sell" role="alert">
                    {describeForexError(engine.error)}
                  </p>
                ) : null}
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Id</th>
                      <th className="px-2 py-1.5 font-medium">Symbol</th>
                      <th className="px-2 py-1.5 font-medium">Side</th>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                      <th className="px-2 py-1.5 font-medium">Price</th>
                      <th className="px-2 py-1.5 font-medium">Vol</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((o) => {
                      const canCancel = PENDING_STATUSES.has(String(o.status).toUpperCase());
                      return (
                        <tr key={o.orderId} className="border-t border-border/80 hover:bg-accent/40">
                          <td className="px-2 py-1.5">{o.orderId.slice(0, 8)}</td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => focusSymbol(o.symbol)}
                            >
                              {o.symbol}
                            </button>
                          </td>
                          <td className={cn('px-2 py-1.5', o.side === 'buy' ? 'text-buy' : 'text-sell')}>{o.side}</td>
                          <td className="px-2 py-1.5">{o.type}</td>
                          <td className="px-2 py-1.5">{o.requestedPrice ? fxNum(o.requestedPrice) : '—'}</td>
                          <td className="px-2 py-1.5">
                            {o.filledVolume}/{o.requestedVolume}
                          </td>
                          <td className="px-2 py-1.5">
                            {o.status}
                            {o.failureReason ? (
                              <span className="block text-[10px] text-muted-foreground">{o.failureReason}</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5">
                            {canCancel ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={engine.busy || cancelId === o.orderId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 disabled:opacity-50"
                                  onClick={() => {
                                    const next = window.prompt(
                                      'New trigger/limit price (leave blank to keep)',
                                      o.requestedPrice ?? ''
                                    );
                                    if (next == null) return;
                                    const vol = window.prompt('New volume (leave blank to keep)', o.requestedVolume);
                                    if (vol == null) return;
                                    setCancelId(o.orderId);
                                    void engine
                                      .modify(o.orderId, {
                                        requestedPrice: next.trim() || undefined,
                                        volume: vol.trim() || undefined,
                                        expectedVersion: o.version,
                                      })
                                      .finally(() => setCancelId(null));
                                  }}
                                >
                                  Modify
                                </button>
                                <button
                                  type="button"
                                  disabled={engine.busy || cancelId === o.orderId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-sell/40 hover:text-sell disabled:opacity-50"
                                  onClick={() => {
                                    if (!window.confirm(`Cancel order ${o.orderId.slice(0, 8)}…?`)) return;
                                    setCancelId(o.orderId);
                                    void engine.cancel(o.orderId).finally(() => setCancelId(null));
                                  }}
                                >
                                  {cancelId === o.orderId ? '…' : 'Cancel'}
                                </button>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === 'history' ? (
            <div className="p-2">
              {fills.length === 0 ? (
                <p className="px-1 py-3 text-[12px] text-muted-foreground">No fills yet.</p>
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
                <p className="mt-2 px-1 text-[10px] text-muted-foreground">
                  {ledger.length} ledger rows available in Account → Ledger.
                </p>
              ) : null}
            </div>
          ) : tab === 'risk' ? (
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <RiskCard label="Account risk" value={fxPlain(risk?.state)} note={risk?.reason} />
              <RiskCard
                label="Margin"
                value={fxPlain(margin?.status)}
                note={margin?.marginLevel != null ? `Level ${fxPlain(margin.marginLevel)}` : undefined}
              />
              <RiskCard label="Used / Free" value={`${fxNum(margin?.usedMargin, 2)} / ${fxNum(margin?.freeMargin, 2)}`} />
              <RiskCard
                label="Exposure"
                value={fxPlain((exposure?.accountNet as string) ?? (exposure?.net as string) ?? margin?.netExposure)}
                note={
                  risk?.dealing
                    ? risk.dealing.account.newOrderEnabled === false
                      ? 'New orders disabled'
                      : 'New orders enabled'
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-start justify-center gap-2 px-4 py-4">
              <p className="text-[12px] font-semibold text-foreground">Depth of Market unavailable</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                This Forex feed does not provide institutional order-book depth. Bid/Ask quotes are available in Market Watch
                and the chart. DOM levels are not fabricated.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">Status · UNAVAILABLE · SIMULATED quotes only</p>
            </div>
          )}
        </div>
      ) : (
        <p className="sr-only">Bottom panel collapsed. Expand to view {tab}.</p>
      )}
    </section>
  );
}

function RiskCard(props: { label: string; value: string; note?: string | null }) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-muted/15 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{props.label}</p>
      <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{props.value}</p>
      {props.note ? <p className="mt-0.5 text-[10px] text-muted-foreground">{props.note}</p> : null}
    </div>
  );
}
