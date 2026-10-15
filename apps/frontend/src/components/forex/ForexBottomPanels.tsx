'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { describeForexError } from '@/lib/forex/models/errors';
import type { ForexLedgerReconciliation, ForexLedgerRow, ForexPublicOrder, ForexPublicPosition, ForexPublicProtection, ForexServerJournalEvent } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexStore } from '@/lib/forex/state/store';
import { type ForexBottomTab, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { buildCurrencyExposure, type CurrencyExposureRow } from '@/lib/forex/models/exposure-view';
import { describeAlertCondition, type ForexServerAlertRow } from '@/lib/forex/models/customer-alerts';
import {
  closedTradesFromLedger,
  computePerformance,
  historyBalanceEntries,
  ledgerCashDrawdown,
  periodBounds,
  postedFeeByFill,
  postedSwapByPosition,
  type HistoryPeriod,
} from '@/lib/forex/models/history-analytics';
import { buildForexJournal } from '@/lib/forex/models/journal';
import { ForexPositionPanel } from './ForexPositionPanel';
import { fxNum, fxPlain } from './format';

const TOOLBOX_TAB_ORDER: ForexBottomTab[] = [
  'positions',
  'risk',
  'history',
  'news',
  'alerts',
  'mailbox',
  'calendar',
  'journal',
];

const PENDING_STATUSES = new Set(['ACCEPTED', 'PENDING', 'NEW', 'TRIGGERING', 'VALIDATING', 'CANCEL_PENDING', 'WORKING', 'OPEN', 'PARTIAL']);

export function ForexBottomPanels(props: { compact?: boolean; hasTradingData?: boolean }) {
  const tf = useTranslations('forex');
  const TABS: Array<{ id: ForexBottomTab; label: string }> = useMemo(
    () => [
      { id: 'positions', label: tf('bottomTabs.positions') },
      { id: 'orders', label: tf('bottomTabs.orders') },
      { id: 'fills', label: tf('bottomTabs.fills') },
      { id: 'history', label: tf('bottomTabs.history') },
      { id: 'risk', label: tf('bottomTabs.risk') },
      { id: 'analytics', label: tf('bottomTabs.analytics') },
      { id: 'alerts', label: tf('bottomTabs.alerts') },
      { id: 'dom', label: tf('bottomTabs.dom') },
      { id: 'tape', label: tf('bottomTabs.tape') },
      { id: 'news', label: tf('bottomTabs.news') },
      { id: 'mailbox', label: tf('bottomTabs.mailbox') },
      { id: 'calendar', label: tf('bottomTabs.calendar') },
      { id: 'journal', label: tf('bottomTabs.journal') },
    ],
    [tf]
  );
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
  const quotes = useForexStore((s) => s.quotes);
  const instruments = useForexStore((s) => s.instruments);
  const positions = useForexStore((s) => s.positions);
  const account = useForexStore((s) => s.account);
  const ledgerReconciliation = useForexStore((s) => s.ledgerReconciliation);
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

  useEffect(() => {
    if (tab !== 'news') return;
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
        reason: items.length ? undefined : res.data.reason ?? tf('bottomPanels.noNewsItems'),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, tf]);

  useEffect(() => {
    if (tab !== 'calendar') return;
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
        reason: events.length ? undefined : res.data.reason ?? tf('bottomPanels.noCalendarEvents'),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, tf]);

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
  const feeByFill = useMemo(() => postedFeeByFill(ledger), [ledger]);
  const perf = useMemo(() => computePerformance(closedTrades, {
    commission: fees?.total != null ? Number(fees.total) : undefined,
    swap: swaps?.total != null ? Number(swaps.total) : undefined,
  }), [closedTrades, fees?.total, swaps?.total]);
  const dd = useMemo(() => ledgerCashDrawdown(ledger), [ledger]);
  const currencyExposure = useMemo(
    () =>
      buildCurrencyExposure({
        positions: Object.values(positions),
        instruments,
        quotes,
        accountCurrency: account?.currency ?? 'USD',
      }),
    [positions, instruments, quotes, account?.currency]
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
      className="fx-dock terminal-panel-subtle flex h-full min-h-0 flex-col border-t border-border"
      aria-label={tf('bottomPanels.ariaLabel')}
    >
      {!compact ? (
        <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
          {tab === 'news' ? (
            <NewsPanel status={newsState.status} reason={newsState.reason} items={newsState.items} />
          ) : tab === 'calendar' ? (
            <CalendarPanel status={calState.status} reason={calState.reason} events={calState.events} />
          ) : tab === 'journal' ? (
            <JournalPanel
              server={journalState}
              client={journal}
              onRefresh={() => setJournalNonce((n) => n + 1)}
            />
          ) : tab === 'positions' || tab === 'orders' ? (
            <div>
              <ForexPositionPanel />
              {authed && workingOrders.length > 0 ? (
                <div className="border-t border-border/70">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {tf('bottomTabs.orders')}
                  </p>
                  {engine.error ? (
                    <p className="px-3 py-1.5 text-[11px] text-sell" role="alert">
                      {describeForexError(engine.error)}
                    </p>
                  ) : null}
                  {workingOrders.length === 0 && orderRows.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-muted-foreground">{tf('bottomPanels.noWorkingOrders')}</p>
                  ) : (
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
                  )}
                </div>
              ) : null}
            </div>
          ) : !authed ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{tf('bottomPanels.signInPrompt')}</p>
              <Link href="/login?redirect=/forex/trade" className="text-[11px] text-primary hover:underline">
                {tf('signIn.link')}
              </Link>
            </div>
          ) : tab === 'fills' ? (
            fills.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">{tf('bottomPanels.noFills')}</p>
            ) : (
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.fill')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.order')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.symbol')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.side')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.vol')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.price')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.fee')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.type')}</th>
                    <th className="px-2 py-1 font-medium">{tf('bottomPanels.fills.time')}</th>
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
                      <td className="px-2 py-1">{feeByFill[f.fillId] != null ? fixedNum(feeByFill[f.fillId], 2) : '0.00'}</td>
                      <td className="px-2 py-1">{f.executionId ? tf('chrome.simulated') : '—'}</td>
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
              ledger={ledger}
              bounds={histBounds}
              reconciliation={ledgerReconciliation}
              currency={account?.currency ?? 'USD'}
              positions={Object.values(positions)}
              protections={Object.values(protections)}
            />
          ) : tab === 'risk' ? (
            <ExposurePanel
              rows={currencyExposure}
              margin={margin}
              account={account}
              currency={account?.currency ?? 'USD'}
            />
          ) : tab === 'analytics' ? (
            <AnalyticsPanel perf={perf} dd={dd} period={histPeriod} onPeriod={setHistPeriod} currency={account?.currency ?? 'USD'} />
          ) : tab === 'alerts' ? (
            <AlertsPanel />
          ) : tab === 'tape' ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
              <p className="text-[12px] font-semibold">{tf('bottomPanels.tape.title')}</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">{tf('bottomPanels.tape.body')}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{tf('bottomPanels.tape.badge')}</p>
            </div>
          ) : tab === 'dom' ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
              <p className="text-[12px] font-semibold">{tf('bottomPanels.dom.title')}</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">{tf('bottomPanels.dom.body')}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{tf('bottomPanels.dom.badge')}</p>
            </div>
          ) : tab === 'mailbox' ? (
            <MailboxPanel />
          ) : null}
        </div>
      ) : (
        <p className="sr-only">{tf('bottomPanels.collapsedSr', { tab: TABS.find((t) => t.id === tab)?.label ?? tab })}</p>
      )}

      <div className="fx-dock-tabs mt-auto flex h-8 shrink-0 items-stretch gap-0.5 overflow-x-auto border-t border-border px-1" role="tablist">
        {[
          ...TOOLBOX_TAB_ORDER.map((id) => TABS.find((t) => t.id === id)).filter((t): t is { id: ForexBottomTab; label: string } => Boolean(t)),
          ...TABS.filter((t) => t.id === tab && t.id !== 'orders' && !TOOLBOX_TAB_ORDER.includes(t.id)),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id || (t.id === 'positions' && tab === 'orders')}
            onClick={() => {
              setTab(t.id === 'orders' ? 'positions' : t.id);
              if (compact) setBottomCollapsed(false);
            }}
            className={cn(
              'fx-dock-tab shrink-0 px-2.5 text-[11px] font-medium tracking-wide focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tab === t.id || (t.id === 'positions' && tab === 'orders')
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
        {!authed ? (
          <Link
            href="/login?redirect=/forex/trade"
            className="ml-auto text-[10px] text-primary underline-offset-2 hover:underline"
          >
            {tf('signIn.link')}
          </Link>
        ) : (
          <button
            type="button"
            className="ml-auto rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => toggleBottomCollapsed()}
            aria-pressed={compact}
          >
            {compact ? tf('bottomPanels.expand') : tf('bottomPanels.collapse')}
          </button>
        )}
      </div>
    </section>
  );
}

type IntelStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

function cellText(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'null' || text === 'undefined') return '';
  return text;
}

function mtTime(value: unknown): string {
  const raw = cellText(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fixedNum(value: number, digits: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function priceCell(value: string | undefined, digits = 5): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return fixedNum(n, digits);
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#14b8a6', '#ef4444', '#64748b'];

function DockColumns(props: { columns: string[]; testId?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={props.testId}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left font-mono text-[11px]">
          <thead>
            <tr>
              {props.columns.map((column, index) => (
                <th key={`${column}-${index}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>{props.children}</tbody>
        </table>
      </div>
      {props.footer ? <div className="fx-dock-summary">{props.footer}</div> : null}
    </div>
  );
}

function IntelNote(props: { status: IntelStatus; reason?: string; empty: string }) {
  const tf = useTranslations('forex');
  if (props.status === 'loading' || props.status === 'idle') {
    return <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">{tf('bottomPanels.loading')}</p>;
  }
  if (props.status === 'error') {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-sell" role="alert">
        {props.reason ?? tf('bottomPanels.requestFailed')}
      </p>
    );
  }
  return (
    <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
      {props.empty}
      {props.reason ? ` · ${props.reason}` : ''}
    </p>
  );
}

function NewsPanel(props: { status: IntelStatus; reason?: string; items: Array<Record<string, unknown>> }) {
  const tf = useTranslations('forex');
  const columns = [tf('bottomPanels.mt4.colTime'), tf('bottomPanels.mt4.colHeadline')];
  const showRows = props.status === 'ready' && props.items.length > 0;
  return (
    <DockColumns columns={columns} testId="news-table">
      {showRows ? (
        props.items.slice(0, 80).map((item, index) => (
          <tr key={String(item.id ?? item.headline ?? index)} className="border-b border-border/70">
            <td className="whitespace-nowrap px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {mtTime(item.time ?? item.publishedAt ?? item.timestamp)}
            </td>
            <td className="px-2 py-0.5 text-[11px]">
              {/^https?:\/\//i.test(cellText(item.url)) ? (
                <a href={cellText(item.url)} target="_blank" rel="noreferrer" className="hover:underline">
                  {cellText(item.headline ?? item.title) || tf('bottomPanels.headlineUnavailable')}
                </a>
              ) : (
                cellText(item.headline ?? item.title) || tf('bottomPanels.headlineUnavailable')
              )}
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={2}>
            <IntelNote status={props.status} reason={props.reason} empty={tf('bottomPanels.newsEmpty')} />
          </td>
        </tr>
      )}
    </DockColumns>
  );
}

function CalendarPanel(props: { status: IntelStatus; reason?: string; events: Array<Record<string, unknown>> }) {
  const tf = useTranslations('forex');
  const mk = (key: string) => tf(`bottomPanels.mt4.${key}`);
  const columns = [mk('colTime'), mk('colCurrency'), mk('colEvent'), mk('colImpact'), mk('colPrevious'), mk('colForecast'), mk('colActual')];
  const showRows = props.status === 'ready' && props.events.length > 0;
  return (
    <DockColumns columns={columns} testId="calendar-table">
      {showRows ? (
        props.events.slice(0, 80).map((event, index) => {
          const impact = cellText(event.impact);
          const tone = /high/i.test(impact) ? 'text-sell' : /med/i.test(impact) ? 'text-amber-200' : /low/i.test(impact) ? 'text-buy' : '';
          return (
            <tr key={String(event.id ?? `${event.event}-${event.time}-${index}`)} className="border-b border-border/70">
              <td className="whitespace-nowrap px-2 py-0.5 font-mono text-[11px]">{mtTime(event.time ?? event.timestamp)}</td>
              <td className="px-2 py-0.5 font-mono text-[11px]">{cellText(event.currency)}</td>
              <td className="px-2 py-0.5 text-[11px]">{cellText(event.event ?? event.title) || tf('bottomPanels.eventUnavailable')}</td>
              <td className={cn('px-2 py-0.5 text-[11px]', tone)}>{impact}</td>
              <td className="px-2 py-0.5 font-mono text-[11px]">{cellText(event.previous)}</td>
              <td className="px-2 py-0.5 font-mono text-[11px]">{cellText(event.forecast)}</td>
              <td className="px-2 py-0.5 font-mono text-[11px]">{cellText(event.actual)}</td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td colSpan={7}>
            <IntelNote status={props.status} reason={props.reason} empty={tf('bottomPanels.calendarEmpty')} />
          </td>
        </tr>
      )}
    </DockColumns>
  );
}

function MailboxPanel() {
  const tf = useTranslations('forex');
  const authed = useForexPrivateSession();
  const [rows, setRows] = useState<Array<{ id: string; time: string; from: string; headline: string }>>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  useEffect(() => {
    if (!authed) {
      setRows([]);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void forexApi.alertEvents().then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) {
        setStatus('error');
        setRows([]);
        return;
      }
      const events = Array.isArray(res.data.events) ? res.data.events : [];
      setRows(
        events.map((event) => ({
          id: String(event.eventId ?? event.createdAt ?? ''),
          time: mtTime(event.createdAt),
          from: cellText(event.deliveryChannel) || 'Terminal',
          headline: cellText(event.message),
        }))
      );
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [authed]);
  const columns = [tf('bottomPanels.mt4.colTime'), tf('bottomPanels.mt4.colFrom'), tf('bottomPanels.mt4.colHeadline')];
  return (
    <DockColumns columns={columns} testId="mailbox-table">
      {rows.length === 0 ? (
        <tr>
          <td colSpan={3} className="px-2 py-6 text-center text-[12px] text-muted-foreground">
            {status === 'loading' || status === 'idle'
              ? tf('bottomPanels.loading')
              : status === 'error'
                ? tf('bottomPanels.requestFailed')
                : tf('bottomPanels.mt4.noMessages')}
          </td>
        </tr>
      ) : (
        rows.map((row) => (
          <tr key={row.id} className="border-b border-border/70">
            <td className="whitespace-nowrap px-2 py-0.5 font-mono text-[11px]">{row.time}</td>
            <td className="px-2 py-0.5 text-[11px]">{row.from}</td>
            <td className="px-2 py-0.5 text-[11px]">{row.headline}</td>
          </tr>
        ))
      )}
    </DockColumns>
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
  const tf = useTranslations('forex');
  const useServer = props.server.status === 'ready';
  const origin = useServer ? tf('bottomPanels.journal.originServer') : tf('bottomPanels.journal.originClient');
  const note = useServer
    ? tf('bottomPanels.journal.noteServer', { count: props.server.events.length })
    : props.server.status === 'loading'
      ? tf('bottomPanels.journal.loading')
      : props.server.status === 'unavailable'
        ? tf('bottomPanels.journal.unavailable')
        : props.server.status === 'error'
          ? tf('bottomPanels.journal.error', { reason: props.server.reason ?? tf('bottomPanels.requestFailed') })
          : tf('bottomPanels.journal.fallback');

  const columns = [tf('bottomPanels.mt4.colTime'), tf('bottomPanels.mt4.colMessage')];
  const serverRows = props.server.events.map((event) => ({
    id: event.id,
    time: event.timestamp,
    severity: event.severity,
    message: [event.category, event.eventType, event.message].filter(Boolean).join(' · '),
  }));
  const clientRows = props.client.map((event) => ({
    id: event.id,
    time: event.timestamp,
    severity: event.severity,
    message: [event.category, event.message].filter(Boolean).join(' · '),
  }));
  const rows = useServer ? serverRows : clientRows;

  return (
    <div data-testid="journal-table">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-[10px] text-muted-foreground">{origin}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{note}</span>
        <button type="button" className="shrink-0 text-[10px] text-primary hover:underline" onClick={props.onRefresh}>
          {tf('bottomPanels.journal.refresh')}
        </button>
      </div>
      <DockColumns columns={columns}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-2 py-2 text-[11px] text-muted-foreground">
              {tf('bottomPanels.journal.empty')}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70">
              <td className={cn('whitespace-nowrap px-2 py-0.5 font-mono text-[11px]', severityClass(row.severity))}>{mtTime(row.time)}</td>
              <td className="px-2 py-0.5 text-[11px]">{row.message}</td>
            </tr>
          ))
        )}
      </DockColumns>
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
  const tf = useTranslations('forex');
  const ok = (key: string) => tf(`bottomPanels.orders.${key}`);
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[860px] text-left font-mono text-[11px] tabular-nums">
      <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wide text-muted-foreground">
        <tr>
          {props.showActions ? (
            <th className="sticky left-0 z-[1] bg-card px-2 py-1 font-medium">{ok('action')}</th>
          ) : null}
          <th className="px-2 py-1 font-medium">{ok('id')}</th>
          <th className="px-2 py-1 font-medium">{ok('symbol')}</th>
          <th className="px-2 py-1 font-medium">{ok('side')}</th>
          <th className="px-2 py-1 font-medium">{ok('type')}</th>
          <th className="px-2 py-1 font-medium" title={ok('entryTitle')}>
            {ok('entry')}
          </th>
          <th className="px-2 py-1 font-medium" title={ok('limitTitle')}>
            {ok('limit')}
          </th>
          <th className="px-2 py-1 font-medium" title={ok('tifTitle')}>
            {ok('tif')}
          </th>
          <th className="px-2 py-1 font-medium">{ok('current')}</th>
          <th className="px-2 py-1 font-medium">{ok('vol')}</th>
          <th className="px-2 py-1 font-medium">{ok('sl')}</th>
          <th className="px-2 py-1 font-medium">{ok('tp')}</th>
          <th className="px-2 py-1 font-medium">{ok('status')}</th>
          <th className="px-2 py-1 font-medium">{ok('created')}</th>
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
                  {ok('save')}
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                  onClick={props.cancelEdit}
                >
                  {ok('abort')}
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
                  {ok('confirm')}
                </button>
                <button type="button" className="rounded border border-border px-1.5 py-0.5 text-[10px]" onClick={() => props.onCancelAsk?.(null)}>
                  {ok('no')}
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
                  {ok('modify')}
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
                  aria-label={tf('bottomPanels.orders.cancelAria', { id: o.orderId.slice(0, 8) })}
                >
                  {props.busyId === o.orderId ? '…' : ok('cancel')}
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
                    aria-label={ok('modifyPriceAria')}
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
                    aria-label={ok('modifyLimitAria')}
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
                    aria-label={ok('modifyVolumeAria')}
                  />
                ) : (
                  `${o.filledVolume}/${o.requestedVolume}`
                )}
              </td>
              <td className="px-2 py-1">
                {editing && props.setEditSl ? (
                  <input value={props.editSl ?? ''} onChange={(e) => props.setEditSl?.(e.target.value)} className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[11px]" aria-label={ok('modifySlAria')} />
                ) : (
                  o.stopLoss ?? '—'
                )}
              </td>
              <td className="px-2 py-1">
                {editing && props.setEditTp ? (
                  <input value={props.editTp ?? ''} onChange={(e) => props.setEditTp?.(e.target.value)} className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[11px]" aria-label={ok('modifyTpAria')} />
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

const HISTORY_PERIOD_KEY: Record<HistoryPeriod, string> = {
  today: 'periodToday',
  yesterday: 'periodYesterday',
  week: 'periodWeek',
  month: 'periodMonth',
  custom: 'periodCustom',
  all: 'periodAll',
};

function PeriodBar(props: { period: HistoryPeriod; onPeriod: (p: HistoryPeriod) => void }) {
  const tf = useTranslations('forex');
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
          {tf(`bottomPanels.history.${HISTORY_PERIOD_KEY[p]}`)}
        </button>
      ))}
    </div>
  );
}

function historySide(side: string | undefined): string {
  const value = String(side ?? '').toLowerCase();
  if (value === 'long' || value === 'buy') return 'buy';
  if (value === 'short' || value === 'sell') return 'sell';
  return '';
}

function historyProtectionPrice(protections: ForexPublicProtection[], positionId: string | undefined, type: 'STOP_LOSS' | 'TAKE_PROFIT'): string {
  if (!positionId) return '';
  const rank = (status: string) => (status === 'FILLED' ? 3 : status === 'TRIGGERED' || status === 'EXECUTING' ? 2 : status === 'ACTIVE' ? 1 : 0);
  const hit = protections
    .filter((p) => p.positionId === positionId && p.type === type)
    .sort((a, b) => rank(b.status) - rank(a.status))[0];
  return hit?.triggerPrice ?? '';
}

function HistoryPanel(props: {
  period: HistoryPeriod;
  onPeriod: (p: HistoryPeriod) => void;
  trades: ReturnType<typeof closedTradesFromLedger>;
  ledger: ForexLedgerRow[];
  bounds: { from: number; to: number };
  reconciliation: ForexLedgerReconciliation | null;
  currency: string;
  positions: ForexPublicPosition[];
  protections: ForexPublicProtection[];
}) {
  const tf = useTranslations('forex');
  const mk = (key: string) => tf(`bottomPanels.mt4.${key}`);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const exportKindKey = { orders: 'exportKindOrders', fills: 'exportKindFills', ledger: 'exportKindLedger' } as const;
  const balance = historyBalanceEntries(props.ledger, props.bounds);
  const swaps = postedSwapByPosition(props.ledger);
  const fees = postedFeeByFill(props.ledger);
  const openedAt = new Map(props.positions.map((p) => [p.positionId, p.openedAt]));
  const rows = [
    ...props.trades.map((trade) => ({
      id: trade.ticket,
      sort: Date.parse(trade.timestamp) || 0,
      order: trade.ticket.length > 10 ? trade.ticket.slice(0, 8) : trade.ticket,
      openTime: mtTime(trade.positionId ? openedAt.get(trade.positionId) : ''),
      type: historySide(trade.side),
      size: trade.volume ? priceCell(trade.volume, 2) : '',
      symbol: trade.symbol,
      openPrice: priceCell(trade.openPrice),
      sl: historyProtectionPrice(props.protections, trade.positionId, 'STOP_LOSS'),
      tp: historyProtectionPrice(props.protections, trade.positionId, 'TAKE_PROFIT'),
      closeTime: mtTime(trade.timestamp),
      closePrice: priceCell(trade.closePrice),
      commission: trade.fillId && fees[trade.fillId] != null ? fixedNum(fees[trade.fillId], 2) : '0.00',
      taxes: '0.00',
      swap: trade.positionId && swaps[trade.positionId] != null ? fixedNum(swaps[trade.positionId], 2) : '0.00',
      profit: trade.gross,
    })),
    ...balance.map((entry) => ({
      id: entry.id,
      sort: Date.parse(entry.timestamp) || 0,
      order: entry.id.length > 10 ? entry.id.slice(0, 8) : entry.id,
      openTime: mtTime(entry.timestamp),
      type: 'balance',
      size: '',
      symbol: '',
      openPrice: '',
      sl: '',
      tp: '',
      closeTime: '',
      closePrice: '',
      commission: '',
      taxes: '',
      swap: '',
      profit: entry.amount,
    })),
  ].sort((a, b) => b.sort - a.sort);
  const profitLoss = props.trades.reduce((sum, trade) => sum + trade.gross, 0);
  let deposit = balance.filter((entry) => entry.bucket === 'deposit').reduce((sum, entry) => sum + entry.amount, 0);
  let withdrawal = balance.filter((entry) => entry.bucket === 'withdrawal').reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const credit = balance.filter((entry) => entry.bucket === 'credit').reduce((sum, entry) => sum + entry.amount, 0);
  if (props.period === 'all' && props.reconciliation) {
    if (props.reconciliation.deposits != null && props.reconciliation.deposits !== '') deposit = Number(props.reconciliation.deposits) || 0;
    if (props.reconciliation.withdrawals != null && props.reconciliation.withdrawals !== '') {
      withdrawal = Number(props.reconciliation.withdrawals) || 0;
    }
  }
  const columns = [
    mk('colOrder'),
    mk('colTime'),
    mk('colType'),
    mk('colSize'),
    mk('colSymbol'),
    mk('colPrice'),
    mk('colSl'),
    mk('colTp'),
    mk('colTime'),
    mk('colPrice'),
    mk('colCommission'),
    mk('colTaxes'),
    mk('colSwap'),
    mk('colProfit'),
  ];
  const periods = (['today', 'yesterday', 'week', 'month', 'all'] as HistoryPeriod[]).concat(
    props.period === 'custom' ? (['custom'] as HistoryPeriod[]) : []
  );
  return (
    <div data-testid="history-table">
      <div className="fx-dock-toolbar">
        <select
          value={props.period}
          onChange={(e) => props.onPeriod(e.target.value as HistoryPeriod)}
          aria-label={tf('bottomPanels.history.periodAria')}
          className="fx-dock-select"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {tf(`bottomPanels.history.${HISTORY_PERIOD_KEY[p]}`)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
          {(['orders', 'fills', 'ledger'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={exportBusy != null}
              className="fx-dock-export disabled:opacity-50"
              onClick={() => {
                setExportBusy(kind);
                import('@/lib/forex/api/client')
                  .then(({ downloadForexHistoryCsv }) => downloadForexHistoryCsv(kind))
                  .catch(() => undefined)
                  .finally(() => setExportBusy(null));
              }}
            >
              {exportBusy === kind
                ? tf('bottomPanels.history.exportBusy')
                : tf('bottomPanels.history.exportCsv', { kind: tf(`bottomPanels.history.${exportKindKey[kind]}`) })}
            </button>
          ))}
        </div>
      </div>
      <DockColumns
        columns={columns}
        footer={
          <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono">
            <span>
              {mk('profitLoss')}: <span className={profitLoss > 0 ? 'text-buy' : profitLoss < 0 ? 'text-sell' : ''}>{fixedNum(profitLoss, 2)}</span>
            </span>
            <span>
              {mk('credit')}: {fixedNum(credit, 2)}
            </span>
            <span>
              {mk('deposit')}: {fixedNum(deposit, 2)}
            </span>
            <span>
              {mk('withdrawal')}: {fixedNum(withdrawal, 2)}
            </span>
            <span className="text-muted-foreground">{props.currency}</span>
          </p>
        }
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={14} className="px-2 py-2 text-[11px] text-muted-foreground">
              {tf('bottomPanels.history.noPnl')}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70 font-mono text-[11px]">
              <td className="px-2 py-0.5" title={row.id}>
                {row.order}
              </td>
              <td className="whitespace-nowrap px-2 py-0.5">{row.openTime}</td>
              <td className={cn('px-2 py-0.5', row.type === 'buy' ? 'text-buy' : row.type === 'sell' ? 'text-sell' : '')}>
                {row.type === 'balance' ? mk('balanceType') : row.type}
              </td>
              <td className="px-2 py-0.5">{row.size}</td>
              <td className="px-2 py-0.5">{row.symbol}</td>
              <td className="px-2 py-0.5">{row.openPrice}</td>
              <td className="px-2 py-0.5">{row.sl ? priceCell(row.sl) : ''}</td>
              <td className="px-2 py-0.5">{row.tp ? priceCell(row.tp) : ''}</td>
              <td className="whitespace-nowrap px-2 py-0.5">{row.closeTime}</td>
              <td className="px-2 py-0.5">{row.closePrice}</td>
              <td className="px-2 py-0.5">{row.commission}</td>
              <td className="px-2 py-0.5">{row.taxes}</td>
              <td className="px-2 py-0.5">{row.swap}</td>
              <td className={cn('px-2 py-0.5', row.profit > 0 ? 'text-buy' : row.profit < 0 ? 'text-sell' : '')}>{fixedNum(row.profit, 2)}</td>
            </tr>
          ))
        )}
      </DockColumns>
    </div>
  );
}

function ExposurePanel(props: {
  rows: CurrencyExposureRow[];
  margin: ReturnType<typeof useForexStore.getState>['margin'];
  account: ReturnType<typeof useForexStore.getState>['account'];
  currency: string;
}) {
  const tf = useTranslations('forex');
  const mk = (key: string) => tf(`bottomPanels.mt4.${key}`);
  const ek = (key: string) => tf(`bottomPanels.exposure.${key}`);
  const maxAbs = props.rows.reduce((max, row) => Math.max(max, row.value == null ? 0 : Math.abs(row.value)), 0);
  const positive = props.rows.filter((row): row is CurrencyExposureRow & { value: number } => row.value != null && row.value > 0);
  const positiveTotal = positive.reduce((sum, row) => sum + row.value, 0);
  let pieCursor = 0;
  const pie = positiveTotal > 0
    ? `conic-gradient(${positive
        .map((row, index) => {
          const start = (pieCursor / positiveTotal) * 100;
          pieCursor += row.value;
          const end = (pieCursor / positiveTotal) * 100;
          return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`;
        })
        .join(',')})`
    : '';
  const money = (value: string | number | null | undefined) => {
    if (value == null || value === '') return '';
    const n = Number(value);
    return Number.isFinite(n) ? fixedNum(n, 2) : '';
  };
  const used = props.margin?.usedMargin ?? props.account?.usedMargin;
  const level =
    props.account?.marginLevel == null || Number(used) === 0 ? '' : `${Number(props.account.marginLevel).toFixed(2)}%`;
  return (
    <div data-testid="exposure-table">
      <div className="flex min-w-0 items-start">
        <div className="min-w-0 flex-1">
          <DockColumns columns={[mk('colAsset'), mk('colVolume'), mk('colRate'), props.currency, mk('colGraph')]}>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-2 text-[11px] text-muted-foreground">
                  {ek('noExposure')}
                </td>
              </tr>
            ) : (
              props.rows.map((row) => {
                const width = row.value == null || maxAbs <= 0 ? 0 : (Math.abs(row.value) / maxAbs) * 100;
                return (
                  <tr key={row.asset} className="border-b border-border/70 font-mono text-[11px]">
                    <td className="px-2 py-0.5">{row.asset}</td>
                    <td className={cn('px-2 py-0.5', row.volume > 0 ? 'text-buy' : row.volume < 0 ? 'text-sell' : '')}>
                      {fixedNum(row.volume, 2)}
                    </td>
                    <td className="px-2 py-0.5">{row.rate == null ? '' : fixedNum(row.rate, row.rate >= 50 ? 3 : 5)}</td>
                    <td className={cn('px-2 py-0.5', (row.value ?? 0) > 0 ? 'text-buy' : (row.value ?? 0) < 0 ? 'text-sell' : '')}>
                      {row.value == null ? '' : fixedNum(row.value, 2)}
                    </td>
                    <td className="px-2 py-0.5">
                      <span className="block h-2 w-24 bg-muted/40">
                        <span
                          className="block h-2"
                          style={{ width: `${width}%`, background: row.volume < 0 ? '#ef4444' : '#3b82f6' }}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </DockColumns>
        </div>
        {pie ? (
          <div className="flex shrink-0 items-center gap-2 px-3 py-2" data-testid="exposure-pie">
            <div className="h-20 w-20 rounded-full" style={{ background: pie }} />
            <ul className="space-y-0.5 text-[10px]">
              {positive.map((row, index) => (
                <li key={row.asset} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                  {row.asset}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="fx-dock-summary flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono">
        <span>
          <span className="fx-k">{ek('balance')}:</span>
          {money(props.account?.ledgerBalance)}
        </span>
        <span>
          {ek('equity')}: {money(props.account?.equity)}
        </span>
        <span>
          {mk('margin')}: {money(used)}
        </span>
        <span>
          {mk('freeMargin')}: {money(props.margin?.freeMargin ?? props.account?.freeMargin)}
        </span>
        <span>
          {mk('marginLevel')}: {level}
        </span>
      </p>
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
  const tf = useTranslations('forex');
  const ak = (key: string) => tf(`bottomPanels.analytics.${key}`);
  const p = props.perf;
  return (
    <div className="space-y-2 px-3 py-2">
      <PeriodBar period={props.period} onPeriod={props.onPeriod} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
        <RiskLine k={ak('trades')} v={String(p.trades)} />
        <RiskLine k={ak('winRate')} v={p.winRate != null ? `${p.winRate}%` : '—'} />
        <RiskLine k={ak('grossProfit')} v={p.grossProfit} />
        <RiskLine k={ak('grossLoss')} v={p.grossLoss} />
        <RiskLine k={ak('net')} v={p.netProfit} />
        <RiskLine k={ak('profitFactor')} v={p.profitFactor ?? '—'} />
        <RiskLine k={ak('avgWin')} v={p.averageWin ?? '—'} />
        <RiskLine k={ak('avgLoss')} v={p.averageLoss ?? '—'} />
        <RiskLine k={ak('largestWin')} v={p.largestWin ?? '—'} />
        <RiskLine k={ak('largestLoss')} v={p.largestLoss ?? '—'} />
        <RiskLine k={ak('expected')} v={p.expectedPayoff ?? '—'} />
        <RiskLine k={ak('commSwap')} v={`${p.commission} / ${p.swap}`} />
        <RiskLine k={ak('peakCash')} v={props.dd.peak ?? '—'} />
        <RiskLine k={ak('maxDd')} v={props.dd.maxDrawdown ?? '—'} />
        <RiskLine k={ak('ddPct')} v={props.dd.maxDrawdownPct != null ? `${props.dd.maxDrawdownPct}%` : '—'} />
        <RiskLine k={ak('currentDd')} v={props.dd.currentDrawdown ?? '—'} />
      </div>
      <p className="text-[10px] text-muted-foreground">{props.dd.note} · {props.currency}</p>
    </div>
  );
}

function alertConditionLabel(row: ForexServerAlertRow): string {
  const condition = row.condition ?? {};
  const price = condition.price ?? condition.level ?? condition.threshold;
  const compare = condition.side === 'below' ? '<' : condition.side === 'above' ? '>' : '';
  const leg = row.alertType === 'ASK' ? 'Ask' : row.alertType === 'BID' || row.alertType === 'PRICE' ? 'Bid' : '';
  if (leg && compare && price != null && String(price) !== '') return `${leg} ${compare} ${price}`;
  return describeAlertCondition(row.alertType, condition);
}

function AlertsPanel() {
  const tf = useTranslations('forex');
  const mk = (key: string) => tf(`bottomPanels.mt4.${key}`);
  const authed = useForexPrivateSession();
  const [localAlerts, setLocalAlerts] = useState<Array<{ id: string; symbol: string; side: 'above' | 'below'; price: string }>>([]);
  const [serverAlerts, setServerAlerts] = useState<ForexServerAlertRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [latestEvent, setLatestEvent] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('eda-forex-local-alerts-v1');
      if (raw) setLocalAlerts(JSON.parse(raw) as typeof localAlerts);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authed) {
      setServerAlerts([]);
      setCounts({});
      setLatestEvent({});
      return;
    }
    let cancelled = false;
    void forexApi.listAlerts().then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) {
        setServerError(res.error.message);
        setServerAlerts([]);
        return;
      }
      setServerError(null);
      const alerts = (res.data as { alerts?: ForexServerAlertRow[] }).alerts ?? [];
      setServerAlerts(Array.isArray(alerts) ? alerts : []);
    });
    void forexApi.alertEvents().then((raw) => {
      if (cancelled) return;
      const res = unwrap(raw);
      if (!res.ok) return;
      const nextCounts: Record<string, number> = {};
      const nextLatest: Record<string, string> = {};
      for (const event of res.data.events ?? []) {
        const id = String(event.alertId ?? '');
        if (!id) continue;
        nextCounts[id] = (nextCounts[id] ?? 0) + 1;
        if (!nextLatest[id]) nextLatest[id] = cellText(event.message) || mtTime(event.createdAt);
      }
      setCounts(nextCounts);
      setLatestEvent(nextLatest);
    });
    return () => {
      cancelled = true;
    };
  }, [authed, reload]);

  async function toggleAlert(alert: ForexServerAlertRow) {
    setBusyId(alert.alertId);
    const res = unwrap(await forexApi.patchAlert(alert.alertId, { enabled: !alert.enabled }));
    setBusyId(null);
    if (!res.ok) {
      setServerError(res.error.message);
      return;
    }
    setReload((n) => n + 1);
  }

  async function removeAlert(alertId: string) {
    setBusyId(alertId);
    const res = unwrap(await forexApi.deleteAlert(alertId));
    setBusyId(null);
    if (!res.ok) {
      setServerError(res.error.message);
      return;
    }
    setReload((n) => n + 1);
  }

  function removeLocal(id: string) {
    setLocalAlerts((cur) => {
      const next = cur.filter((alert) => alert.id !== id);
      try {
        localStorage.setItem('eda-forex-local-alerts-v1', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const columns = [mk('colSymbol'), mk('colCondition'), mk('colCount'), mk('colLimit'), mk('colTimeout'), mk('colExpiration'), mk('colEvent'), ''];
  const localRows = localAlerts.map((alert) => ({
    id: `local-${alert.id}`,
    localId: alert.id,
    symbol: alert.symbol,
    condition: `Bid ${alert.side === 'below' ? '<' : '>'} ${alert.price}`,
    count: '',
    limit: '',
    timeout: '',
    expiration: '',
    event: '',
    server: null as ForexServerAlertRow | null,
  }));
  const serverRows = serverAlerts.map((alert) => ({
    id: alert.alertId,
    symbol: alert.symbol ?? '',
    condition: alertConditionLabel(alert),
    count: String(counts[alert.alertId] ?? 0),
    limit: cellText(alert.condition?.limit ?? alert.condition?.maxCount),
    timeout: Number.isFinite(alert.cooldownSeconds) ? String(alert.cooldownSeconds) : '',
    expiration: cellText(alert.condition?.expiration ?? alert.condition?.expiresAt),
    event: latestEvent[alert.alertId] || mtTime(alert.lastTriggeredAt) || '',
    localId: '',
    server: alert,
  }));
  const rows = [...serverRows, ...localRows];

  return (
    <div data-testid="alerts-table">
      <div className="flex justify-end px-2 py-0.5">
        <Link href="/forex/alerts" className="text-[10px] text-primary hover:underline">
          {mk('manageAlerts')}
        </Link>
      </div>
      <DockColumns columns={columns}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-2 py-2 text-[11px] text-muted-foreground">
              {serverError ?? mk('noAlerts')}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70 font-mono text-[11px]">
              <td className="px-2 py-0.5">{row.symbol}</td>
              <td className="px-2 py-0.5">{row.condition}</td>
              <td className="px-2 py-0.5">{row.count}</td>
              <td className="px-2 py-0.5">{row.limit}</td>
              <td className="px-2 py-0.5">{row.timeout}</td>
              <td className="px-2 py-0.5">{row.expiration}</td>
              <td className="px-2 py-0.5">{row.event}</td>
              <td className="px-2 py-0.5 whitespace-nowrap">
                {row.server ? (
                  <span className="inline-flex gap-1">
                    <button
                      type="button"
                      disabled={busyId === row.server.alertId}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-50"
                      onClick={() => void toggleAlert(row.server!)}
                    >
                      {row.server.enabled ? mk('alertDisable') : mk('alertEnable')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.server.alertId}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-sell disabled:opacity-50"
                      onClick={() => void removeAlert(row.server!.alertId)}
                    >
                      {mk('alertDelete')}
                    </button>
                  </span>
                ) : row.localId ? (
                  <button
                    type="button"
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] text-sell"
                    onClick={() => removeLocal(row.localId)}
                  >
                    {mk('alertDelete')}
                  </button>
                ) : null}
              </td>
            </tr>
          ))
        )}
      </DockColumns>
    </div>
  );
}
