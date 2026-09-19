import { create } from 'zustand';
import { shouldAcceptQuote } from '../models/quotes';
import { normalizeForexError } from '../models/errors';
import type {
  ForexError,
  ForexAccountView,
  ForexConnectionState,
  ForexFillRow,
  ForexInstrument,
  ForexLedgerReconciliation,
  ForexLedgerRow,
  ForexMarginSnapshot,
  ForexPnlView,
  ForexPublicOrder,
  ForexPublicPosition,
  ForexPublicProtection,
  ForexQuoteDto,
  ForexRiskStatus,
  ForexSessionSnapshot,
  ForexTradingConfig,
} from '../models/types';
import type { ForexWsEnvelope } from '../websocket/channels';
import type { ForexCustomerAccountSummary } from '../api/client';

export type ForexHydratePhase = 'idle' | 'hydrating' | 'ready' | 'error';

export interface ForexDomainState {
  hydratePhase: ForexHydratePhase;
  hydrateError: ForexError | null;
  lastHydratedAt: number | null;
  socketState: ForexConnectionState;
  socketDetail: string | null;
  lastPongAt: number | null;
  privateWsAuth: boolean | null;
  lastError: ForexError | null;

  instruments: Record<string, ForexInstrument>;
  quotes: Record<string, ForexQuoteDto>;
  providerHealth: Array<{ status?: string; providerCode?: string }>;
  sessions: ForexSessionSnapshot | null;
  tradingConfig: ForexTradingConfig | null;

  forexAccounts: ForexCustomerAccountSummary[];
  activeForexAccountId: string | null;

  account: ForexAccountView | null;
  margin: ForexMarginSnapshot | null;
  riskStatus: ForexRiskStatus | null;
  risk: unknown;
  exposure: Record<string, unknown> | null;
  pnl: ForexPnlView | null;
  balance: { ledgerBalance: string; availableBalance: string; equity: string; currency: string; calculationStatus: string } | null;

  orders: Record<string, ForexPublicOrder>;
  positions: Record<string, ForexPublicPosition>;
  fills: ForexFillRow[];
  protections: Record<string, ForexPublicProtection>;
  fees: { currency?: string; total?: string; transactions: ForexLedgerRow[] } | null;
  swaps: { currency?: string; total?: string; transactions: ForexLedgerRow[]; history: unknown[] } | null;
  ledger: ForexLedgerRow[];
  ledgerReconciliation: ForexLedgerReconciliation | null;
  funding: ForexLedgerRow[];
  liquidation: Record<string, unknown> | null;

  ticketBusy: boolean;
  ticketLastOrder: ForexPublicOrder | null;

  applyPublicHydrate: (p: {
    instruments?: ForexInstrument[];
    quotes?: ForexQuoteDto[];
    providers?: Array<{ status?: string; providerCode?: string }>;
    sessions?: ForexSessionSnapshot;
    tradingConfig?: ForexTradingConfig;
  }) => void;
  applyForexAccounts: (p: { accounts: ForexCustomerAccountSummary[]; activeAccountId: string }) => void;
  clearPrivateForexData: () => void;
  applyPrivateHydrate: (p: {
    account?: ForexAccountView;
    margin?: ForexMarginSnapshot;
    riskStatus?: ForexRiskStatus;
    risk?: unknown;
    exposure?: Record<string, unknown>;
    pnl?: ForexPnlView;
    balance?: ForexDomainState['balance'];
    orders?: ForexPublicOrder[];
    positions?: ForexPublicPosition[];
    fills?: ForexFillRow[];
    protections?: ForexPublicProtection[];
    fees?: ForexDomainState['fees'];
    swaps?: ForexDomainState['swaps'];
    ledger?: ForexLedgerRow[];
    ledgerReconciliation?: ForexLedgerReconciliation | null;
    funding?: ForexLedgerRow[];
    liquidation?: Record<string, unknown> | null;
  }) => void;
  setHydratePhase: (phase: ForexHydratePhase, error?: ForexError | null) => void;
  setSocketState: (state: ForexConnectionState, detail?: string | null) => void;
  setLastPong: (ts: number) => void;
  setLastError: (err: ForexError | null) => void;
  setTicketBusy: (busy: boolean) => void;
  setTicketLastOrder: (order: ForexPublicOrder | null) => void;
  applyWs: (msg: ForexWsEnvelope) => void;
}

function indexBy<T>(rows: T[] | undefined, key: keyof T): Record<string, T> {
  const out: Record<string, T> = {};
  if (!rows) return out;
  for (const row of rows) {
    const id = row[key];
    if (typeof id === 'string' && id) out[id] = row;
  }
  return out;
}

function isSubscribeStub(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.status === 'SUBSCRIBED' && d.order == null && d.position == null && d.account == null && d.fill == null;
}

export const useForexStore = create<ForexDomainState>((set, get) => ({
  hydratePhase: 'idle',
  hydrateError: null,
  lastHydratedAt: null,
  socketState: 'DISCONNECTED',
  socketDetail: null,
  lastPongAt: null,
  privateWsAuth: null,
  lastError: null,
  instruments: {},
  quotes: {},
  providerHealth: [],
  sessions: null,
  tradingConfig: null,
  forexAccounts: [],
  activeForexAccountId: null,
  account: null,
  margin: null,
  riskStatus: null,
  risk: null,
  exposure: null,
  pnl: null,
  balance: null,
  orders: {},
  positions: {},
  fills: [],
  protections: {},
  fees: null,
  swaps: null,
  ledger: [],
  ledgerReconciliation: null,
  funding: [],
  liquidation: null,
  ticketBusy: false,
  ticketLastOrder: null,

  applyPublicHydrate: (p) =>
    set((s) => ({
      instruments: p.instruments ? indexBy(p.instruments, 'symbol') : s.instruments,
      quotes: p.quotes
        ? {
            ...s.quotes,
            ...Object.fromEntries(
              p.quotes.filter((q) => shouldAcceptQuote(s.quotes[q.symbol], q)).map((q) => [q.symbol, q])
            ),
          }
        : s.quotes,
      providerHealth: p.providers ?? s.providerHealth,
      sessions: p.sessions ?? s.sessions,
      tradingConfig: p.tradingConfig ?? s.tradingConfig,
      lastHydratedAt: Date.now(),
    })),

  applyForexAccounts: (p) =>
    set({
      forexAccounts: p.accounts,
      activeForexAccountId: p.activeAccountId,
    }),

  clearPrivateForexData: () =>
    set({
      account: null,
      balance: null,
      margin: null,
      riskStatus: null,
      risk: null,
      exposure: null,
      pnl: null,
      orders: {},
      positions: {},
      fills: [],
      protections: {},
      fees: null,
      swaps: null,
      ledger: [],
      ledgerReconciliation: null,
      funding: [],
      liquidation: null,
      ticketLastOrder: null,
    }),

  applyPrivateHydrate: (p) =>
    set((s) => ({
      account: p.account ?? s.account,
      margin: p.margin ?? s.margin,
      riskStatus: p.riskStatus ?? s.riskStatus,
      risk: p.risk ?? s.risk,
      exposure: p.exposure ?? s.exposure,
      pnl: p.pnl ?? s.pnl,
      balance: p.balance ?? s.balance,
      orders: p.orders ? indexBy(p.orders, 'orderId') : s.orders,
      positions: p.positions ? indexBy(p.positions, 'positionId') : s.positions,
      fills: p.fills ?? s.fills,
      protections: p.protections ? indexBy(p.protections, 'protectionId') : s.protections,
      fees: p.fees ?? s.fees,
      swaps: p.swaps ?? s.swaps,
      ledger: p.ledger ?? s.ledger,
      ledgerReconciliation: p.ledgerReconciliation !== undefined ? p.ledgerReconciliation : s.ledgerReconciliation,
      funding: p.funding ?? s.funding,
      liquidation: p.liquidation !== undefined ? p.liquidation : s.liquidation,
      lastHydratedAt: Date.now(),
    })),

  setHydratePhase: (hydratePhase, error) =>
    set({ hydratePhase, hydrateError: error ?? null }),
  setSocketState: (socketState, socketDetail) => set({ socketState, socketDetail: socketDetail ?? null }),
  setLastPong: (lastPongAt) => set({ lastPongAt }),
  setLastError: (lastError) => set({ lastError }),
  setTicketBusy: (ticketBusy) => set({ ticketBusy }),
  setTicketLastOrder: (ticketLastOrder) => set({ ticketLastOrder }),

  applyWs: (msg) => {
    if (!msg.type) return;
    if (msg.type === 'error') {
      const err = normalizeForexError(msg.data);
      if (err.code === 'AUTH_REQUIRED') {
        set({ privateWsAuth: false, lastError: err });
        return;
      }
      set({ lastError: err });
      return;
    }
    if (msg.type === 'subscribed' || msg.type === 'unsubscribed' || msg.type === 'welcome' || msg.type === 'pong') {
      if (msg.type === 'subscribed') {
        const ok = Boolean((msg.data as { ok?: boolean } | undefined)?.ok);
        if (ok && msg.channel && msg.channel.startsWith('fx.') && msg.channel !== 'fx.quote.*') {
          /* public or private ack */
        }
      }
      return;
    }
    if (isSubscribeStub(msg.data)) return;

    const data = (msg.data ?? {}) as Record<string, unknown>;

    if (msg.type === 'fx.quote' && data.symbol) {
      const q = data as unknown as ForexQuoteDto;
      const prev = get().quotes[q.symbol];
      if (shouldAcceptQuote(prev, q)) {
        set({ quotes: { ...get().quotes, [q.symbol]: q } });
      }
      return;
    }

    if (msg.type.startsWith('fx.order') && data.order && typeof data.order === 'object') {
      const order = data.order as ForexPublicOrder;
      if (!order.orderId) return;
      const prev = get().orders[order.orderId];
      if (prev && typeof prev.version === 'number' && order.version < prev.version) return;
      set({ orders: { ...get().orders, [order.orderId]: order } });
      return;
    }

    if (msg.type === 'fx.fill' && data.fill && typeof data.fill === 'object') {
      const fill = data.fill as ForexFillRow;
      if (!fill.fillId) return;
      const fills = get().fills;
      if (fills.some((f) => f.fillId === fill.fillId)) return;
      set({ fills: [fill, ...fills].slice(0, 500) });
      return;
    }

    if (msg.type === 'fx.position' && data.position && typeof data.position === 'object') {
      const position = data.position as ForexPublicPosition;
      if (!position.positionId) return;
      const prev = get().positions[position.positionId];
      if (prev && position.version < prev.version) return;
      set({ positions: { ...get().positions, [position.positionId]: position } });
      return;
    }

    if (msg.type === 'fx.margin' && data.margin && typeof data.margin === 'object') {
      set({ margin: data.margin as ForexMarginSnapshot });
      return;
    }

    if (msg.type === 'fx.risk') {
      if (data.risk && typeof data.risk === 'object') set({ risk: data.risk });
      if (typeof data.state === 'string') {
        set({
          riskStatus: {
            ...(get().riskStatus ?? {
              source: 'SIMULATED',
              executionMode: 'MOCK',
              valuationKind: 'CALCULATED',
              state: 'NORMAL',
              reason: null,
              liquidationLock: false,
              dealing: {
                emergencyHalt: false,
                emergencyAllowRiskReduction: true,
                symbol: { enabled: true, buyEnabled: true, sellEnabled: true, newOrderEnabled: true, riskReductionEnabled: true },
                account: { enabled: true, newOrderEnabled: true, riskReductionEnabled: true },
                source: 'SIMULATED',
              },
            }),
            state: data.state as ForexRiskStatus['state'],
            reason: typeof data.reason === 'string' ? data.reason : get().riskStatus?.reason ?? null,
          },
        });
      }
      return;
    }

    if (msg.type === 'fx.account' && data.account && typeof data.account === 'object') {
      set({ account: data.account as ForexAccountView });
      return;
    }

    if (msg.type === 'fx.balance' && data.balance && typeof data.balance === 'object') {
      const b = data.balance as ForexDomainState['balance'];
      if (b) set({ balance: b });
      return;
    }

    if (msg.type === 'fx.pnl' && data.pnl && typeof data.pnl === 'object') {
      set({ pnl: data.pnl as ForexPnlView });
      return;
    }

    if (msg.type === 'fx.equity' && typeof data.equity === 'string') {
      const acc = get().account;
      if (acc) set({ account: { ...acc, equity: data.equity, calculationStatus: String(data.calculationStatus ?? acc.calculationStatus) } });
      return;
    }

    if (msg.type === 'fx.funding' && data.funding && typeof data.funding === 'object') {
      const row = data.funding as ForexLedgerRow;
      if (row.transactionId && !get().funding.some((t) => t.transactionId === row.transactionId)) {
        set({ funding: [row, ...get().funding].slice(0, 200) });
      }
      return;
    }

    if (msg.type.startsWith('fx.protection') && data.protection && typeof data.protection === 'object') {
      const p = data.protection as ForexPublicProtection;
      if (p.protectionId) set({ protections: { ...get().protections, [p.protectionId]: p } });
      return;
    }

    if (msg.type.startsWith('fx.liquidation') && data.liquidation && typeof data.liquidation === 'object') {
      set({ liquidation: data.liquidation as Record<string, unknown> });
      return;
    }

    if (msg.type === 'fx.exposure') {
      const exp = (data.exposure as Record<string, unknown> | undefined) ?? data;
      set({ exposure: exp });
      return;
    }

    if (msg.type === 'fx.dealing' && data.dealing && typeof data.dealing === 'object') {
      const rs = get().riskStatus;
      if (rs) set({ riskStatus: { ...rs, dealing: data.dealing as ForexRiskStatus['dealing'] } });
      return;
    }

    if (msg.type === 'fx.restriction') {
      const rs = get().riskStatus;
      if (rs && typeof data.state === 'string') {
        set({
          riskStatus: {
            ...rs,
            state: data.state as ForexRiskStatus['state'],
            reason: typeof data.reason === 'string' ? data.reason : rs.reason,
          },
        });
      }
    }
  },
}));
