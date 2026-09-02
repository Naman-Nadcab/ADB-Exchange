'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError } from '@/lib/forex/models/errors';
import type { ForexPublicOrder } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexStore } from '@/lib/forex/state/store';
import { type ForexBottomTab, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexPositionPanel } from './ForexPositionPanel';
import { fxNum, fxPlain } from './format';

const TABS: Array<{ id: ForexBottomTab; label: string }> = [
  { id: 'positions', label: 'Trade' },
  { id: 'orders', label: 'Orders' },
  { id: 'fills', label: 'Fills' },
  { id: 'history', label: 'History' },
  { id: 'risk', label: 'Exposure' },
  { id: 'dom', label: 'DOM' },
];

const PENDING_STATUSES = new Set(['ACCEPTED', 'PENDING', 'NEW', 'TRIGGERING', 'VALIDATING', 'CANCEL_PENDING', 'WORKING', 'OPEN', 'PARTIAL']);
const CLOSED_STATUSES = new Set(['FILLED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'CLOSED']);

export function ForexBottomPanels(props: { compact?: boolean; hasTradingData?: boolean }) {
  const tab = useForexWorkspaceStore((s) => s.bottomTab);
  const setTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editVol, setEditVol] = useState('');
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
  const workingOrders = useMemo(
    () => orderRows.filter((o) => PENDING_STATUSES.has(String(o.status).toUpperCase())),
    [orderRows]
  );
  const historyOrders = useMemo(
    () => orderRows.filter((o) => CLOSED_STATUSES.has(String(o.status).toUpperCase())),
    [orderRows]
  );
  const compact = Boolean(props.compact) || bottomCollapsed || chartMode === 'expand';

  function startEdit(o: (typeof orderRows)[number]) {
    setEditId(o.orderId);
    setEditPrice(o.requestedPrice ?? '');
    setEditVol(o.requestedVolume);
  }

  async function submitEdit(o: (typeof orderRows)[number]) {
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

  return (
    <section
      className="terminal-panel-subtle flex h-full min-h-0 flex-col border-t border-border bg-card"
      aria-label="Trade toolbox"
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border px-1.5" role="tablist">
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
              'rounded px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-1 hidden text-[9px] text-muted-foreground sm:inline">
          {props.hasTradingData ? 'Active' : 'Idle'}
        </span>
        {!authed ? (
          <Link
            href="/login?redirect=/forex/trade"
            className="ml-auto text-[10px] text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        ) : (
          <button
            type="button"
            className="ml-auto rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <div className="flex items-center gap-3 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Sign in for orders, fills and risk.</p>
              <Link href="/login?redirect=/forex/trade" className="text-[11px] text-primary hover:underline">
                Sign in
              </Link>
            </div>
          ) : tab === 'orders' ? (
            workingOrders.length === 0 && orderRows.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-muted-foreground">No working orders.</p>
            ) : (
              <div>
                {engine.error ? (
                  <p className="px-3 py-1.5 text-[11px] text-sell" role="alert">
                    {describeForexError(engine.error)}
                  </p>
                ) : null}
                <OrderTable
                  rows={workingOrders.length ? workingOrders : orderRows}
                  focusSymbol={focusSymbol}
                  editId={editId}
                  editPrice={editPrice}
                  editVol={editVol}
                  setEditPrice={setEditPrice}
                  setEditVol={setEditVol}
                  startEdit={startEdit}
                  submitEdit={submitEdit}
                  cancelEdit={() => setEditId(null)}
                  busyId={busyId}
                  engineBusy={engine.busy}
                  onCancel={(id) => {
                    setBusyId(id);
                    void engine.cancel(id).finally(() => setBusyId(null));
                  }}
                  showActions
                />
              </div>
            )
          ) : tab === 'fills' ? (
            fills.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-muted-foreground">No fills yet.</p>
            ) : (
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">Fill</th>
                    <th className="px-2 py-1 font-medium">Order</th>
                    <th className="px-2 py-1 font-medium">Symbol</th>
                    <th className="px-2 py-1 font-medium">Side</th>
                    <th className="px-2 py-1 font-medium">Vol</th>
                    <th className="px-2 py-1 font-medium">Price</th>
                    <th className="px-2 py-1 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.fillId} className="border-t border-border/80 hover:bg-accent/40">
                      <td className="px-2 py-1">{f.fillId.slice(0, 8)}</td>
                      <td className="px-2 py-1">{f.orderId?.slice(0, 8) ?? '—'}</td>
                      <td className="px-2 py-1">{f.symbol}</td>
                      <td className={cn('px-2 py-1', f.side === 'buy' ? 'text-buy' : 'text-sell')}>{f.side}</td>
                      <td className="px-2 py-1">{fxPlain(f.volume)}</td>
                      <td className="px-2 py-1">{fxNum(f.price)}</td>
                      <td className="px-2 py-1">{new Date(f.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === 'history' ? (
            <div>
              {historyOrders.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-muted-foreground">No closed / cancelled orders yet.</p>
              ) : (
                <OrderTable
                  rows={historyOrders}
                  focusSymbol={focusSymbol}
                  editId={null}
                  editPrice=""
                  editVol=""
                  setEditPrice={() => undefined}
                  setEditVol={() => undefined}
                  startEdit={() => undefined}
                  submitEdit={async () => undefined}
                  cancelEdit={() => undefined}
                  busyId={null}
                  engineBusy={false}
                  onCancel={() => undefined}
                  showActions={false}
                />
              )}
              {ledger.length ? (
                <p className="border-t border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
                  {ledger.length} ledger rows · Account → Ledger for full cash movements.
                </p>
              ) : null}
            </div>
          ) : tab === 'risk' ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 py-2 font-mono text-[11px] tabular-nums">
              <RiskLine k="Risk" v={fxPlain(risk?.state)} note={risk?.reason} />
              <RiskLine
                k="Margin"
                v={fxPlain(margin?.status)}
                note={margin?.marginLevel != null ? `Lv ${fxPlain(margin.marginLevel)}` : undefined}
              />
              <RiskLine k="Used" v={fxNum(margin?.usedMargin, 2)} />
              <RiskLine k="Free" v={fxNum(margin?.freeMargin, 2)} />
              <RiskLine
                k="Exposure"
                v={fxPlain((exposure?.accountNet as string) ?? (exposure?.net as string) ?? margin?.netExposure)}
              />
              <RiskLine
                k="Dealing"
                v={
                  risk?.dealing?.account.newOrderEnabled === false
                    ? 'New orders OFF'
                    : 'New orders ON'
                }
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-start justify-center gap-1.5 px-3 py-3">
              <p className="text-[12px] font-semibold">Depth of Market unavailable</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                This Forex feed does not provide institutional order-book depth. Bid/Ask are in Market Watch and the
                chart. DOM levels are not fabricated.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">UNAVAILABLE · SIMULATED quotes</p>
            </div>
          )}
        </div>
      ) : (
        <p className="sr-only">Bottom panel collapsed. Expand to view {tab}.</p>
      )}
    </section>
  );
}

function RiskLine(props: { k: string; v: string; note?: string | null }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{props.k}</span>
      <span className="text-foreground">{props.v}</span>
      {props.note ? <span className="text-[9px] text-muted-foreground">{props.note}</span> : null}
    </span>
  );
}

function OrderTable(props: {
  rows: ForexPublicOrder[];
  focusSymbol: (s: string) => void;
  editId: string | null;
  editPrice: string;
  editVol: string;
  setEditPrice: (v: string) => void;
  setEditVol: (v: string) => void;
  startEdit: (o: ForexPublicOrder) => void;
  submitEdit: (o: ForexPublicOrder) => Promise<void>;
  cancelEdit: () => void;
  busyId: string | null;
  engineBusy: boolean;
  onCancel: (id: string) => void;
  showActions: boolean;
}) {
  return (
    <table className="w-full text-left font-mono text-[11px] tabular-nums">
      <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-2 py-1 font-medium">Id</th>
          <th className="px-2 py-1 font-medium">Symbol</th>
          <th className="px-2 py-1 font-medium">Side</th>
          <th className="px-2 py-1 font-medium">Type</th>
          <th className="px-2 py-1 font-medium">Price</th>
          <th className="px-2 py-1 font-medium">Vol</th>
          <th className="px-2 py-1 font-medium">Status</th>
          {props.showActions ? <th className="px-2 py-1 font-medium">Action</th> : null}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((o) => {
          const editing = props.editId === o.orderId;
          const canAct = props.showActions && PENDING_STATUSES.has(String(o.status).toUpperCase());
          return (
            <tr key={o.orderId} className="border-t border-border/80 hover:bg-accent/40">
              <td className="px-2 py-1">{o.orderId.slice(0, 8)}</td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => props.focusSymbol(o.symbol)}
                >
                  {o.symbol}
                </button>
              </td>
              <td className={cn('px-2 py-1', o.side === 'buy' ? 'text-buy' : 'text-sell')}>{o.side}</td>
              <td className="px-2 py-1">{o.type}</td>
              <td className="px-2 py-1">
                {editing ? (
                  <input
                    value={props.editPrice}
                    onChange={(e) => props.setEditPrice(e.target.value)}
                    className="w-20 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
                    aria-label="Modify price"
                  />
                ) : o.requestedPrice ? (
                  fxNum(o.requestedPrice)
                ) : (
                  '—'
                )}
              </td>
              <td className="px-2 py-1">
                {editing ? (
                  <input
                    value={props.editVol}
                    onChange={(e) => props.setEditVol(e.target.value)}
                    className="w-14 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
                    aria-label="Modify volume"
                  />
                ) : (
                  `${o.filledVolume}/${o.requestedVolume}`
                )}
              </td>
              <td className="px-2 py-1">
                {o.status}
                {o.failureReason ? (
                  <span className="block text-[9px] text-muted-foreground">{o.failureReason}</span>
                ) : null}
              </td>
              {props.showActions ? (
                <td className="px-2 py-1">
                  {canAct ? (
                    editing ? (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={props.engineBusy || props.busyId === o.orderId}
                          className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary disabled:opacity-50"
                          onClick={() => void props.submitEdit(o)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                          onClick={props.cancelEdit}
                        >
                          Abort
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={props.engineBusy || props.busyId === o.orderId}
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 disabled:opacity-50"
                          onClick={() => props.startEdit(o)}
                        >
                          Modify
                        </button>
                        <button
                          type="button"
                          disabled={props.engineBusy || props.busyId === o.orderId}
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-sell/40 hover:text-sell disabled:opacity-50"
                          onClick={() => props.onCancel(o.orderId)}
                        >
                          {props.busyId === o.orderId ? '…' : 'Cancel'}
                        </button>
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
