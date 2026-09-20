'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { describeForexError } from '@/lib/forex/models/errors';
import type { ForexPublicOrder, ForexServerJournalEvent } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexStore } from '@/lib/forex/state/store';
import { type ForexBottomTab, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { buildExposureBook } from '@/lib/forex/models/exposure-view';
import {
  closedTradesFromLedger,
  computePerformance,
  ledgerCashDrawdown,
  periodBounds,
  type HistoryPeriod,
} from '@/lib/forex/models/history-analytics';
import { buildForexJournal } from '@/lib/forex/models/journal';
import { livePositionValuation } from '@/lib/forex/models/live-valuation';
import { ForexPositionPanel } from './ForexPositionPanel';
import { ForexServerAlertsPanel } from './ForexServerAlertsPanel';
import { fxMoney, fxNum, fxPlain, fxSigned } from './format';

const TABS: Array<{ id: ForexBottomTab; label: string }> = [
  { id: 'positions', label: 'Trade' },
  { id: 'orders', label: 'Orders' },
  { id: 'fills', label: 'Fills' },
  { id: 'history', label: 'History' },
  { id: 'risk', label: 'Exposure' },
  { id: 'analytics', label: 'Risk' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'dom', label: 'DOM' },
  { id: 'tape', label: 'Tape' },
  { id: 'news', label: 'News' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'journal', label: 'Journal' },
];

const PRIMARY_BOTTOM_TABS = new Set<ForexBottomTab>(['positions', 'orders', 'history']);
const OVERFLOW_BOTTOM_TABS = TABS.filter((t) => !PRIMARY_BOTTOM_TABS.has(t.id));

const PENDING_STATUSES = new Set(['ACCEPTED', 'PENDING', 'NEW', 'TRIGGERING', 'VALIDATING', 'CANCEL_PENDING', 'WORKING', 'OPEN', 'PARTIAL']);
const CLOSED_STATUSES = new Set(['FILLED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'CLOSED']);

export function ForexBottomPanels(props: { compact?: boolean; hasTradingData?: boolean }) {
  const tab = useForexWorkspaceStore((s) => s.bottomTab);
  const setTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editVol, setEditVol] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editSl, setEditSl] = useState('');
  const [editTp, setEditTp] = useState('');
  const [histPeriod, setHistPeriod] = useState<HistoryPeriod>('all');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const authed = useForexPrivateSession();
  const orders = useForexStore((s) => s.orders);
  const fills = useForexStore((s) => s.fills);
  const ledger = useForexStore((s) => s.ledger);
  const margin = useForexStore((s) => s.margin);
  const risk = useForexStore((s) => s.riskStatus);
  const exposure = useForexStore((s) => s.exposure);
  const quotes = useForexStore((s) => s.quotes);
  const instruments = useForexStore((s) => s.instruments);
  const positions = useForexStore((s) => s.positions);
  const account = useForexStore((s) => s.account);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const protections = useForexStore((s) => s.protections);
  const bottomCollapsed = useForexWorkspaceStore((s) => s.bottomCollapsed);
  const toggleBottomCollapsed = useForexWorkspaceStore((s) => s.toggleBottomCollapsed);
  const setBottomCollapsed = useForexWorkspaceStore((s) => s.setBottomCollapsed);
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const socketState = useForexStore((s) => s.socketState);
  const engine = useForexOrderEngine();
  const [newsState, setNewsState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
    items: Array<Record<string, unknown>>;
    reason?: string;
  }>({ status: 'idle', items: [] });
  const [calState, setCalState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
    events: Array<Record<string, unknown>>;
    reason?: string;
  }>({ status: 'idle', events: [] });
  const [journalState, setJournalState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
    events: ForexServerJournalEvent[];
    reason?: string;
  }>({ status: 'idle', events: [] });
  const [journalNonce, setJournalNonce] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const tabInOverflow = OVERFLOW_BOTTOM_TABS.some((t) => t.id === tab);

  useEffect(() => {
    if (tab !== 'news' || newsState.status === 'loading' || newsState.status === 'ready') return;
    let cancelled = false;
    setNewsState({ status: 'loading', items: [] });
    void forexApi.news().then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) {
        setNewsState({ status: 'error', items: [], reason: res.error.message });
        return;
      }
      const avail = String(res.data.availability ?? '').toUpperCase();
      if (avail && avail !== 'AVAILABLE' && avail !== 'OK' && avail !== 'READY') {
        setNewsState({
          status: 'unavailable',
          items: [],
          reason: res.data.reason ?? res.data.availability,
        });
        return;
      }
      const items = Array.isArray(res.data.items) ? (res.data.items as Array<Record<string, unknown>>) : [];
      setNewsState({
        status: items.length ? 'ready' : 'unavailable',
        items,
        reason: items.length ? undefined : res.data.reason ?? 'No news items',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, newsState.status]);

  useEffect(() => {
    if (tab !== 'calendar' || calState.status === 'loading' || calState.status === 'ready') return;
    let cancelled = false;
    setCalState({ status: 'loading', events: [] });
    void forexApi.calendar().then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) {
        setCalState({ status: 'error', events: [], reason: res.error.message });
        return;
      }
      const avail = String(res.data.availability ?? '').toUpperCase();
      if (avail && avail !== 'AVAILABLE' && avail !== 'OK' && avail !== 'READY') {
        setCalState({
          status: 'unavailable',
          events: [],
          reason: res.data.reason ?? res.data.availability,
        });
        return;
      }
      const events = Array.isArray(res.data.events) ? (res.data.events as Array<Record<string, unknown>>) : [];
      setCalState({
        status: events.length ? 'ready' : 'unavailable',
        events,
        reason: events.length ? undefined : res.data.reason ?? 'No calendar events',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, calState.status]);

  // Server journal is authoritative when the route exists. A pre-Phase-A
  // backend has no /journal, so the panel falls back to client-observed state
  // rather than showing an empty log.
  useEffect(() => {
    if (tab !== 'journal' || !authed) return;
    let cancelled = false;
    setJournalState((cur) => ({ ...cur, status: 'loading' }));
    void forexApi.journal(100).then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) {
        const missing =
          res.error.code === 'NOT_FOUND' ||
          res.error.code === 'REQUEST_FAILED' ||
          /not found|route get:\/api\/v1\/forex\/journal/i.test(res.error.message);
        setJournalState({
          status: missing ? 'unavailable' : 'error',
          events: [],
          reason: res.error.message,
        });
        return;
      }
      setJournalState({ status: 'ready', events: res.data.events ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, authed, journalNonce]);

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
    setEditLimit(o.limitPrice ?? '');
    setEditSl(o.stopLoss ?? '');
    setEditTp(o.takeProfit ?? '');
  }

  async function submitEdit(o: (typeof orderRows)[number]) {
    setBusyId(o.orderId);
    try {
      await engine.modify(o.orderId, {
        requestedPrice: editPrice.trim() || undefined,
        volume: editVol.trim() || undefined,
        // Only stop_limit has a working limit price to patch.
        limitPrice: o.type === 'stop_limit' ? editLimit.trim() || undefined : undefined,
        stopLoss: editSl.trim() || undefined,
        takeProfit: editTp.trim() || undefined,
        expectedVersion: o.version,
      });
      setEditId(null);
    } finally {
      setBusyId(null);
    }
  }

  const histBounds = useMemo(() => periodBounds(histPeriod), [histPeriod]);
  const closedTrades = useMemo(() => closedTradesFromLedger(ledger, histBounds), [ledger, histBounds]);
  const perf = useMemo(() => computePerformance(closedTrades, {
    commission: fees?.total != null ? Number(fees.total) : undefined,
    swap: swaps?.total != null ? Number(swaps.total) : undefined,
  }), [closedTrades, fees?.total, swaps?.total]);
  const dd = useMemo(() => ledgerCashDrawdown(ledger), [ledger]);
  const liveVals = useMemo(
    () =>
      Object.values(positions)
        .filter((p) => p.status === 'OPEN')
        .map((p) => livePositionValuation({ position: p, quote: quotes[p.symbol], instrument: instruments[p.symbol] })),
    [positions, quotes, instruments]
  );
  const book = useMemo(
    () => buildExposureBook(Object.values(positions), liveVals),
    [positions, liveVals]
  );
  const journal = useMemo(
    () =>
      buildForexJournal({
        orders: orderRows,
        fills,
        positions: Object.values(positions),
        protections: Object.values(protections),
        hydratePhase,
        socketState,
      }),
    [orderRows, fills, positions, protections, hydratePhase, socketState]
  );

  return (
    <section
      className="terminal-panel-subtle flex h-full min-h-0 flex-col border-t border-border bg-card"
      aria-label="Trade toolbox"
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border px-1.5" role="tablist">
        {TABS.filter((t) => PRIMARY_BOTTOM_TABS.has(t.id)).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setOverflowOpen(false);
              if (compact || t.id === 'orders' || t.id === 'positions') setBottomCollapsed(false);
            }}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tabInOverflow ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            More{tabInOverflow ? ` · ${TABS.find((x) => x.id === tab)?.label ?? ''}` : ''}
          </button>
          {overflowOpen ? (
            <div
              role="menu"
              className="absolute left-0 top-full z-40 mt-0.5 max-h-[min(60vh,320px)] min-w-[140px] overflow-y-auto border border-border bg-[#1a1f26] py-1 shadow-lg"
              onMouseLeave={() => setOverflowOpen(false)}
            >
              {OVERFLOW_BOTTOM_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTab(t.id);
                    setOverflowOpen(false);
                    if (compact || t.id === 'orders' || t.id === 'fills') setBottomCollapsed(false);
                  }}
                  className={cn(
                    'block w-full px-2.5 py-1 text-left text-[11px] hover:bg-accent',
                    tab === t.id ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
                  editLimit={editLimit}
                  editSl={editSl}
                  editTp={editTp}
                  setEditPrice={setEditPrice}
                  setEditVol={setEditVol}
                  setEditLimit={setEditLimit}
                  setEditSl={setEditSl}
                  setEditTp={setEditTp}
                  startEdit={startEdit}
                  submitEdit={submitEdit}
                  cancelEdit={() => setEditId(null)}
                  busyId={busyId}
                  engineBusy={engine.busy}
                  quotes={quotes}
                  cancelId={cancelId}
                  onCancelAsk={setCancelId}
                  onCancelConfirm={(id) => {
                    setBusyId(id);
                    setCancelId(null);
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
                    <th className="px-2 py-1 font-medium">Fee</th>
                    <th className="px-2 py-1 font-medium">Type</th>
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
                      <td className="px-2 py-1">0</td>
                      <td className="px-2 py-1">{f.executionId ? 'SIMULATED' : '—'}</td>
                      <td className="px-2 py-1">{new Date(f.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === 'history' ? (
            <HistoryPanel
              period={histPeriod}
              onPeriod={setHistPeriod}
              trades={closedTrades}
              perf={perf}
              historyOrders={historyOrders}
              ledgerCount={ledger.length}
              currency={account?.currency ?? 'USD'}
            />
          ) : tab === 'risk' ? (
            <ExposurePanel
              book={book}
              margin={margin}
              risk={risk}
              exposure={exposure}
              account={account}
              currency={account?.currency ?? 'USD'}
            />
          ) : tab === 'analytics' ? (
            <AnalyticsPanel perf={perf} dd={dd} period={histPeriod} onPeriod={setHistPeriod} currency={account?.currency ?? 'USD'} />
          ) : tab === 'alerts' ? (
            <AlertsPanel quotes={quotes} />
          ) : tab === 'tape' ? (
            <div className="flex h-full flex-col items-start justify-center gap-1.5 px-3 py-3">
              <p className="text-[12px] font-semibold">Time &amp; Sales unavailable</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                No authoritative trade tape is available from the current SIMULATED market-data provider. Quotes are not
                presented as prints. When a provider supplies tape, it will appear here.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">UNAVAILABLE · PROVIDER_DEPENDENT</p>
            </div>
          ) : tab === 'dom' ? (
            <div className="flex h-full flex-col items-start justify-center gap-1.5 px-3 py-3">
              <p className="text-[12px] font-semibold">Depth of Market unavailable</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                This Forex feed does not provide institutional order-book depth. Bid/Ask are in Market Watch and the
                chart. DOM levels are not fabricated.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">UNAVAILABLE · SIMULATED quotes</p>
            </div>
          ) : tab === 'news' ? (
            <IntelList
              status={newsState.status}
              reason={newsState.reason}
              empty="No news items from provider."
              rows={newsState.items.map((item, i) => ({
                key: String(item.id ?? item.headline ?? i),
                primary: String(item.headline ?? item.title ?? 'Headline unavailable'),
                secondary: [item.source, item.time ?? item.publishedAt, item.currency ?? item.category]
                  .filter(Boolean)
                  .map(String)
                  .join(' · '),
              }))}
            />
          ) : tab === 'calendar' ? (
            <IntelList
              status={calState.status}
              reason={calState.reason}
              empty="No calendar events from provider."
              rows={calState.events.map((ev, i) => ({
                key: String(ev.id ?? `${ev.event}-${ev.time}-${i}`),
                primary: String(ev.event ?? ev.title ?? 'Event unavailable'),
                secondary: [ev.currency, ev.impact, ev.time, ev.actual != null ? `A ${ev.actual}` : 'A —', ev.forecast != null ? `F ${ev.forecast}` : null, ev.previous != null ? `P ${ev.previous}` : null]
                  .filter(Boolean)
                  .map(String)
                  .join(' · '),
              }))}
            />
          ) : (
            <JournalPanel
              server={journalState}
              client={journal}
              onRefresh={() => setJournalNonce((n) => n + 1)}
            />
          )}
        </div>
      ) : (
        <p className="sr-only">Bottom panel collapsed. Expand to view {tab}.</p>
      )}
    </section>
  );
}

function IntelList(props: {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  reason?: string;
  empty: string;
  rows: Array<{ key: string; primary: string; secondary: string }>;
}) {
  if (props.status === 'loading' || props.status === 'idle') {
    return <p className="px-3 py-3 text-[12px] text-muted-foreground">Loading…</p>;
  }
  if (props.status === 'error') {
    return (
      <p className="px-3 py-3 text-[12px] text-sell" role="alert">
        {props.reason ?? 'Request failed'}
      </p>
    );
  }
  if (props.status === 'unavailable' || props.rows.length === 0) {
    return (
      <div className="px-3 py-3">
        <p className="text-[12px] text-muted-foreground">{props.empty}</p>
        {props.reason ? <p className="mt-1 text-[10px] text-muted-foreground">{props.reason}</p> : null}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {props.rows.slice(0, 80).map((r) => (
        <li key={r.key} className="px-3 py-1.5">
          <p className="text-[11px] text-foreground">{r.primary}</p>
          {r.secondary ? <p className="font-mono text-[10px] text-muted-foreground">{r.secondary}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function severityClass(severity: string): string {
  return severity === 'error' ? 'text-sell' : severity === 'warn' ? 'text-amber-200' : 'text-muted-foreground';
}

/**
 * Prefers the append-only server journal. The client-observed fallback is
 * derived from store snapshots, so it is labelled differently and never
 * presented as an authoritative log.
 */
function JournalPanel(props: {
  server: { status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'; events: ForexServerJournalEvent[]; reason?: string };
  client: ReturnType<typeof buildForexJournal>;
  onRefresh: () => void;
}) {
  const useServer = props.server.status === 'ready';
  const origin = useServer ? 'SERVER' : 'CLIENT-OBSERVED';
  const note = useServer
    ? `Append-only server journal · ${props.server.events.length} events · no secrets`
    : props.server.status === 'loading'
      ? 'Loading server journal…'
      : props.server.status === 'unavailable'
        ? 'Server journal not deployed on this backend. Showing entries derived from account state.'
        : props.server.status === 'error'
          ? `Server journal unavailable (${props.server.reason ?? 'request failed'}). Showing entries derived from account state.`
          : 'Showing entries derived from account state.';

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide',
            useServer ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'
          )}
        >
          {origin}
        </span>
        <span className="text-[10px] text-muted-foreground">{note}</span>
        <button
          type="button"
          className="ml-auto text-[10px] text-primary hover:underline"
          onClick={props.onRefresh}
        >
          Refresh
        </button>
      </div>
      {useServer ? (
        props.server.events.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">No server journal events yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {props.server.events.map((e) => (
              <li key={e.id} className="px-3 py-1 font-mono text-[11px]">
                <span className={severityClass(e.severity)}>
                  {new Date(e.timestamp).toLocaleTimeString()} · {e.category} · {e.eventType}
                </span>{' '}
                {e.message}
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="divide-y divide-border/70">
          {props.client.map((e) => (
            <li key={e.id} className="px-3 py-1 font-mono text-[11px]">
              <span className={severityClass(e.severity)}>
                {new Date(e.timestamp).toLocaleTimeString()} · {e.category}
              </span>{' '}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  editLimit?: string;
  editSl?: string;
  editTp?: string;
  setEditPrice: (v: string) => void;
  setEditVol: (v: string) => void;
  setEditLimit?: (v: string) => void;
  setEditSl?: (v: string) => void;
  setEditTp?: (v: string) => void;
  startEdit: (o: ForexPublicOrder) => void;
  submitEdit: (o: ForexPublicOrder) => Promise<void>;
  cancelEdit: () => void;
  busyId: string | null;
  engineBusy: boolean;
  quotes?: Record<string, { bid?: string; ask?: string }>;
  cancelId?: string | null;
  onCancelAsk?: (id: string | null) => void;
  onCancelConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  showActions: boolean;
}) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[860px] text-left font-mono text-[11px] tabular-nums">
      <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wide text-muted-foreground">
        <tr>
          {props.showActions ? (
            <th className="sticky left-0 z-[1] bg-card px-2 py-1 font-medium">Action</th>
          ) : null}
          <th className="px-2 py-1 font-medium">Id</th>
          <th className="px-2 py-1 font-medium">Symbol</th>
          <th className="px-2 py-1 font-medium">Side</th>
          <th className="px-2 py-1 font-medium">Type</th>
          <th className="px-2 py-1 font-medium" title="Stop / trigger price for pending orders">
            Entry
          </th>
          <th className="px-2 py-1 font-medium" title="Stop Limit working limit price">
            Limit
          </th>
          <th className="px-2 py-1 font-medium" title="Time in force">
            TIF
          </th>
          <th className="px-2 py-1 font-medium">Current</th>
          <th className="px-2 py-1 font-medium">Vol</th>
          <th className="px-2 py-1 font-medium">SL</th>
          <th className="px-2 py-1 font-medium">TP</th>
          <th className="px-2 py-1 font-medium">Status</th>
          <th className="px-2 py-1 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((o) => {
          const editing = props.editId === o.orderId;
          const canAct = props.showActions && PENDING_STATUSES.has(String(o.status).toUpperCase());
          const actionCell = canAct ? (
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
            ) : props.cancelId === o.orderId ? (
              <span className="inline-flex gap-1">
                <button
                  type="button"
                  className="rounded border border-sell/40 px-1.5 py-0.5 text-[10px] text-sell"
                  onClick={() => (props.onCancelConfirm ?? props.onCancel)?.(o.orderId)}
                  data-testid={`confirm-cancel-${o.orderId.slice(0, 8)}`}
                >
                  Confirm
                </button>
                <button type="button" className="rounded border border-border px-1.5 py-0.5 text-[10px]" onClick={() => props.onCancelAsk?.(null)}>
                  No
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
                  onClick={() => {
                    if (props.onCancelAsk) props.onCancelAsk(o.orderId);
                    else props.onCancel?.(o.orderId);
                  }}
                  data-testid={`cancel-order-${o.orderId.slice(0, 8)}`}
                  aria-label={`Cancel order ${o.orderId.slice(0, 8)}`}
                >
                  {props.busyId === o.orderId ? '…' : 'Cancel'}
                </button>
              </span>
            )
          ) : (
            <span className="text-muted-foreground">—</span>
          );
          return (
            <tr key={o.orderId} className="border-t border-border/80 hover:bg-accent/40">
              {props.showActions ? (
                <td className="sticky left-0 z-[1] bg-card px-2 py-1 whitespace-nowrap">{actionCell}</td>
              ) : null}
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
                {editing && o.type === 'stop_limit' && props.setEditLimit ? (
                  <input
                    value={props.editLimit ?? ''}
                    onChange={(e) => props.setEditLimit?.(e.target.value)}
                    className="w-20 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
                    aria-label="Modify limit price"
                  />
                ) : o.limitPrice ? (
                  fxNum(o.limitPrice)
                ) : (
                  '—'
                )}
              </td>
              <td className="px-2 py-1">{o.timeInForce ?? '—'}</td>
              <td className="px-2 py-1">
                {props.quotes?.[o.symbol]?.bid ?? '—'}
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
                {editing && props.setEditSl ? (
                  <input value={props.editSl ?? ''} onChange={(e) => props.setEditSl?.(e.target.value)} className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[11px]" aria-label="Modify SL" />
                ) : (
                  o.stopLoss ?? '—'
                )}
              </td>
              <td className="px-2 py-1">
                {editing && props.setEditTp ? (
                  <input value={props.editTp ?? ''} onChange={(e) => props.setEditTp?.(e.target.value)} className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[11px]" aria-label="Modify TP" />
                ) : (
                  o.takeProfit ?? '—'
                )}
              </td>
              <td className="px-2 py-1">
                {o.status}
                {o.failureReason ? (
                  <span className="block text-[9px] text-muted-foreground">{o.failureReason}</span>
                ) : null}
              </td>
              <td className="px-2 py-1">{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

function PeriodBar(props: { period: HistoryPeriod; onPeriod: (p: HistoryPeriod) => void }) {
  return (
    <div className="flex flex-wrap gap-1 px-2 py-1">
      {(['today', 'yesterday', 'week', 'month', 'all'] as HistoryPeriod[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => props.onPeriod(p)}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px]',
            props.period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function HistoryPanel(props: {
  period: HistoryPeriod;
  onPeriod: (p: HistoryPeriod) => void;
  trades: ReturnType<typeof closedTradesFromLedger>;
  perf: ReturnType<typeof computePerformance>;
  historyOrders: ForexPublicOrder[];
  ledgerCount: number;
  currency: string;
}) {
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  return (
    <div>
      <PeriodBar period={props.period} onPeriod={props.onPeriod} />
      <div className="flex flex-wrap gap-2 border-b border-border px-3 py-1.5">
        {(['orders', 'fills', 'ledger'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={exportBusy != null}
            className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide hover:border-primary/40 disabled:opacity-50"
            onClick={() => {
              setExportBusy(kind);
              import('@/lib/forex/api/client')
                .then(({ downloadForexHistoryCsv }) => downloadForexHistoryCsv(kind))
                .catch(() => undefined)
                .finally(() => setExportBusy(null));
            }}
          >
            {exportBusy === kind ? 'Export…' : `CSV ${kind}`}
          </button>
        ))}
        <span className="self-center text-[9px] text-muted-foreground">Server export · your account only</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-3 py-1.5 font-mono text-[10px]">
        <span>Trades {props.perf.trades}</span>
        <span>Win {props.perf.winRate ?? '—'}</span>
        <span>Gross+ {props.perf.grossProfit}</span>
        <span>Gross- {props.perf.grossLoss}</span>
        <span>Net {props.perf.netProfit}</span>
        <span>Comm {props.perf.commission}</span>
        <span>Swap {props.perf.swap}</span>
      </div>
      {props.trades.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-muted-foreground">No realized P&amp;L rows in this period.</p>
      ) : (
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="text-[9px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Ticket</th>
              <th className="px-2 py-1">Symbol</th>
              <th className="px-2 py-1">Gross</th>
              <th className="px-2 py-1">Net</th>
              <th className="px-2 py-1">Time</th>
            </tr>
          </thead>
          <tbody>
            {props.trades.map((t) => (
              <tr key={t.ticket} className="border-t border-border/80">
                <td className="px-2 py-1">{t.ticket.slice(0, 8)}</td>
                <td className="px-2 py-1">{t.symbol || '—'}</td>
                <td className="px-2 py-1">{fxNum(t.gross, 2)}</td>
                <td className="px-2 py-1">{fxNum(t.net, 2)}</td>
                <td className="px-2 py-1">{new Date(t.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="border-t border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
        {props.historyOrders.length} closed orders · {props.ledgerCount} ledger rows · {props.currency}
      </p>
    </div>
  );
}

function ExposurePanel(props: {
  book: ReturnType<typeof buildExposureBook>;
  margin: ReturnType<typeof useForexStore.getState>['margin'];
  risk: ReturnType<typeof useForexStore.getState>['riskStatus'];
  exposure: ReturnType<typeof useForexStore.getState>['exposure'];
  account: ReturnType<typeof useForexStore.getState>['account'];
  currency: string;
}) {
  return (
    <div className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px]">
        <RiskLine k="Balance" v={fxMoney(props.account?.ledgerBalance, props.currency)} />
        <RiskLine k="Equity" v={fxMoney(props.account?.equity, props.currency)} />
        <RiskLine k="Used" v={fxMoney(props.margin?.usedMargin ?? props.account?.usedMargin, props.currency)} />
        <RiskLine k="Free" v={fxMoney(props.margin?.freeMargin ?? props.account?.freeMargin, props.currency)} />
        <RiskLine k="Level" v={props.account?.marginLevel == null || Number(props.account.usedMargin) === 0 ? '—' : `${Number(props.account.marginLevel).toFixed(2)}%`} />
        <RiskLine k="Gross" v={props.book.grossNotional} />
        <RiskLine k="Net" v={props.book.netNotional} />
        <RiskLine k="Long" v={props.book.longNotional} />
        <RiskLine k="Short" v={props.book.shortNotional} />
        <RiskLine k="Long P&L" v={props.book.longPnl} />
        <RiskLine k="Short P&L" v={props.book.shortPnl} />
        <RiskLine k="Server net" v={fxPlain((props.exposure?.accountNet as string) ?? (props.exposure?.net as string) ?? props.margin?.netExposure)} />
        <RiskLine k="Risk" v={fxPlain(props.risk?.state)} note={props.risk?.reason} />
      </div>
      {props.book.bySymbol.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No open exposure.</p>
      ) : (
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="text-[9px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Symbol</th>
              <th className="px-2 py-1">Long</th>
              <th className="px-2 py-1">Short</th>
              <th className="px-2 py-1">Net</th>
              <th className="px-2 py-1">Long P&L</th>
              <th className="px-2 py-1">Short P&L</th>
            </tr>
          </thead>
          <tbody>
            {props.book.bySymbol.map((r) => (
              <tr key={r.symbol} className="border-t border-border/80">
                <td className="px-2 py-1">{r.symbol}</td>
                <td className="px-2 py-1">+{r.longVolume} / {r.longNotional}</td>
                <td className="px-2 py-1">-{r.shortVolume} / {r.shortNotional}</td>
                <td className="px-2 py-1">{r.netVolume} / {r.netNotional}</td>
                <td className="px-2 py-1">{r.longPnl}</td>
                <td className="px-2 py-1">{r.shortPnl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AnalyticsPanel(props: {
  perf: ReturnType<typeof computePerformance>;
  dd: ReturnType<typeof ledgerCashDrawdown>;
  period: HistoryPeriod;
  onPeriod: (p: HistoryPeriod) => void;
  currency: string;
}) {
  const p = props.perf;
  return (
    <div className="space-y-2 px-3 py-2">
      <PeriodBar period={props.period} onPeriod={props.onPeriod} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
        <RiskLine k="Trades" v={String(p.trades)} />
        <RiskLine k="Win rate" v={p.winRate != null ? `${p.winRate}%` : '—'} />
        <RiskLine k="Gross profit" v={p.grossProfit} />
        <RiskLine k="Gross loss" v={p.grossLoss} />
        <RiskLine k="Net" v={p.netProfit} />
        <RiskLine k="Profit factor" v={p.profitFactor ?? '—'} />
        <RiskLine k="Avg win" v={p.averageWin ?? '—'} />
        <RiskLine k="Avg loss" v={p.averageLoss ?? '—'} />
        <RiskLine k="Largest win" v={p.largestWin ?? '—'} />
        <RiskLine k="Largest loss" v={p.largestLoss ?? '—'} />
        <RiskLine k="Expected" v={p.expectedPayoff ?? '—'} />
        <RiskLine k="Comm / Swap" v={`${p.commission} / ${p.swap}`} />
        <RiskLine k="Peak cash" v={props.dd.peak ?? '—'} />
        <RiskLine k="Max DD" v={props.dd.maxDrawdown ?? '—'} />
        <RiskLine k="DD %" v={props.dd.maxDrawdownPct != null ? `${props.dd.maxDrawdownPct}%` : '—'} />
        <RiskLine k="Current DD" v={props.dd.currentDrawdown ?? '—'} />
      </div>
      <p className="text-[10px] text-muted-foreground">{props.dd.note} · {props.currency}</p>
    </div>
  );
}

function AlertsPanel(props: { quotes: Record<string, { bid?: string }> }) {
  const [localAlerts, setLocalAlerts] = useState<Array<{ id: string; symbol: string; side: 'above' | 'below'; price: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('eda-forex-local-alerts-v1');
      if (raw) setLocalAlerts(JSON.parse(raw) as typeof localAlerts);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="space-y-3 pb-2">
      <div className="px-3 pt-1">
        <ForexServerAlertsPanel compact />
      </div>
      <div className="border-t border-border/60 px-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            Local only
          </span>
          <span className="text-[10px] text-muted-foreground">
            Tab-open evaluation only ·{' '}
            <Link href="/forex/alerts" className="text-primary hover:underline">
              /forex/alerts
            </Link>
          </span>
        </div>
        {localAlerts.length === 0 ? (
          <p className="py-1 text-[11px] text-muted-foreground">No local alerts.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {localAlerts.map((a) => {
              const bid = props.quotes[a.symbol]?.bid;
              const hit =
                bid != null &&
                ((a.side === 'above' && Number(bid) >= Number(a.price)) ||
                  (a.side === 'below' && Number(bid) <= Number(a.price)));
              return (
                <li key={a.id} className="py-1 font-mono text-[10px]">
                  {a.symbol} bid {a.side} {a.price}
                  {hit ? ' · triggered locally' : ''}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
