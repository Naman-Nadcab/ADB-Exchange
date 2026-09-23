import { api } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { describeForexError, normalizeForexError } from '../models/errors';
import type { ForexCandleQuery, ForexCandleResponse } from '../models/candles';
import type { ForexPreviewRequest, ForexPreviewResponse } from '../models/preview';
import type {
  ForexAccountView,
  ForexCloseByBody,
  ForexCloseByResult,
  ForexClosePositionBody,
  ForexClosePositionResult,
  ForexCreateProtectionBody,
  ForexError,
  ForexFillRow,
  ForexInstrument,
  ForexLedgerReconciliation,
  ForexLedgerRow,
  ForexMarginSnapshot,
  ForexModifyOrderBody,
  ForexPlaceOrderBody,
  ForexPnlView,
  ForexPublicOrder,
  ForexPublicPosition,
  ForexPublicProtection,
  ForexQuoteDto,
  ForexReverseBody,
  ForexReverseResult,
  ForexRiskStatus,
  ForexServerJournalEvent,
  ForexSessionSnapshot,
  ForexTradingConfig,
} from '../models/types';
import { FOREX_PREFIX } from '../models/types';
import { getForexActiveAccountHeaders } from './account-context';

export type ForexAccountCardSnapshot = {
  isSelected: boolean;
  financialSnapshot: ForexAccountHubPayload['financialSnapshot'];
  activitySummary: { openPositions: number; pendingOrders: number };
  riskState?: string;
};

export type ForexCustomerAccountSummary = {
  accountId: string;
  currency: string;
  status: string;
  accountKind: string;
  label: string;
  positionMode: string;
  leverageOverride?: string | null;
  createdAt: string;
  updatedAt?: string;
  groupCode?: string | null;
  groupLabel?: string | null;
  cardSnapshot?: ForexAccountCardSnapshot;
};

export type ForexAccountHubPayload = {
  source: string;
  executionMode: string;
  realForex: boolean;
  activeAccountId: string;
  isSelected: boolean;
  account: ForexCustomerAccountSummary & {
    updatedAt: string;
    groupCode?: string | null;
    groupLabel?: string | null;
    platformCustomerId?: string;
    tradingLogin?: string;
    brokerTradingLogin?: string | null;
    server?: string;
  };
  fundingHistoryPreview?: ForexLedgerRow[];
  financialSnapshot: {
    currency: string;
    ledgerBalance: string;
    availableBalance: string;
    equity: string;
    usedMargin: string;
    freeMargin: string;
    marginLevel: string | null;
    unrealizedPnl: string;
    realizedPnl: string;
    calculationStatus: string;
    timestamp: string;
  };
  riskSnapshot: {
    state?: string;
    reason?: string | null;
    liquidationLock?: boolean;
    margin?: unknown;
    exposure?: unknown;
  };
  activitySummary: { openPositions: number; pendingOrders: number };
  preview: {
    openPositions: ForexPublicPosition[];
    recentOrders: ForexPublicOrder[];
    recentFills: ForexFillRow[];
  };
};

function fxRequestInit(extra?: { signal?: AbortSignal; headers?: Record<string, string> }) {
  return {
    notifyOnError: false as const,
    signal: extra?.signal,
    headers: { ...getForexActiveAccountHeaders(), ...extra?.headers },
  };
}

export type ForexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ForexError; statusHint?: string };

export function unwrap<T>(res: { success: boolean; data?: T; error?: { code?: string; message?: string; source?: string } }): ForexResult<T> {
  if (res.success && res.data !== undefined) return { ok: true, data: res.data };
  const error = normalizeForexError(res.error ?? res);
  return { ok: false, error: { ...error, message: describeForexError(error) } };
}

function fxGet<T>(path: string, skipAuth = false, signal?: AbortSignal) {
  const headers = skipAuth ? undefined : getForexActiveAccountHeaders();
  return api.get<T>(`${FOREX_PREFIX}${path}`, { skipAuth, notifyOnError: false, signal, headers });
}

export const forexApi = {
  instruments: () => fxGet<{ count: number; instruments: ForexInstrument[] }>('/instruments', true),
  quotes: () =>
    fxGet<{ source: string; count: number; quotes: ForexQuoteDto[]; providers: unknown[] }>('/quotes', true),
  quote: (symbol: string) =>
    fxGet<{ source: string; quality: string; freshness: string; quote: ForexQuoteDto }>(
      `/quotes/${encodeURIComponent(symbol)}`,
      true
    ),
  sessions: () => fxGet<ForexSessionSnapshot>('/sessions', true),
  tradingConfig: () => fxGet<ForexTradingConfig>('/trading-config', true),
  capabilities: () =>
    fxGet<{ contract: unknown; execution: unknown; tradingConfig: ForexTradingConfig }>('/capabilities', true),
  listAlerts: () => fxGet<{ count: number; alerts: unknown[] }>('/alerts'),
  listAccounts: () =>
    fxGet<{
      source: string;
      executionMode: string;
      realForex: boolean;
      activeAccountId: string;
      count: number;
      accounts: ForexCustomerAccountSummary[];
    }>('/accounts'),
  getAccountById: (accountId: string) => fxGet<ForexAccountHubPayload>(`/accounts/${encodeURIComponent(accountId)}`),
  getLiveOpeningEligibility: () =>
    fxGet<{
      source: string;
      realForex: boolean;
      liveAccountOpeningAvailable: boolean;
      applicationAccepted?: boolean;
      kycVerified?: boolean;
      blockers?: string[];
      reason: string;
      message: string;
    }>('/accounts/live-opening/eligibility'),
  getLiveReadiness: () =>
    fxGet<{
      liveForexReady: false;
      realForexEffective: boolean;
      executionMode: string;
      source: string;
      blockers: string[];
      capabilities: {
        liveAccountApplication: boolean;
        liveAccountProvisioning: boolean;
        brokerCredentials: boolean;
        deposit: boolean;
        withdrawal: boolean;
        internalTransfer: boolean;
        paymentMethods: boolean;
        fundingReconciliation: boolean;
      };
    }>('/live/readiness'),
  submitLiveApplication: (body: { idempotencyKey: string; positionMode?: 'NETTING' | 'HEDGING'; leverage?: string | null }) =>
    api.post<{ application: Record<string, unknown> }>(`${FOREX_PREFIX}/live/applications`, body, fxRequestInit()),
  listLiveApplications: () => fxGet<{ count: number; applications: Array<Record<string, unknown>> }>('/live/applications'),
  postInternalTransfer: (body: { fromAccountId: string; toAccountId: string; amount: string; idempotencyKey: string }) =>
    api.post<{ status: string; transaction: ForexLedgerRow }>(`${FOREX_PREFIX}/funding/transfers`, body, fxRequestInit()),
  getAccountCredentials: (accountId: string) =>
    fxGet<{
      accountId: string;
      tradingPassword: { available: boolean; reason: string };
      investorPassword: { available: boolean; reason: string };
    }>(`/accounts/${encodeURIComponent(accountId)}/credentials`),
  getForexPaymentMethods: () =>
    fxGet<{ available: boolean; count: number; methods: unknown[]; reason: string | null; blockers: string[] }>(
      '/funding/payment-methods'
    ),
  getAccountFundingHistory: (accountId: string) =>
    fxGet<{ source: string; accountId: string; count: number; transactions: ForexLedgerRow[] }>(
      `/accounts/${encodeURIComponent(accountId)}/funding-history`
    ),
  selectAccount: (accountId: string) =>
    api.post<{ source: string; activeAccountId: string; realForex: boolean }>(
      `${FOREX_PREFIX}/accounts/${encodeURIComponent(accountId)}/select`,
      {},
      fxRequestInit()
    ),
  createDemoAccount: () =>
    api.post<{
      source: string;
      scope: string;
      realForex: boolean;
      account: ForexCustomerAccountSummary & { userId: string; updatedAt: string };
      activeAccountId: string;
    }>(`${FOREX_PREFIX}/accounts`, { kind: 'DEMO' }, fxRequestInit()),
  createAlert: (body: Record<string, unknown>) =>
    api.post<{ alert: unknown }>(`${FOREX_PREFIX}/alerts`, body, fxRequestInit()),
  deleteAlert: (alertId: string) =>
    api.delete<{ deleted: string }>(`${FOREX_PREFIX}/alerts/${encodeURIComponent(alertId)}`, fxRequestInit()),
  patchAlert: (alertId: string, body: Record<string, unknown>) =>
    api.patch<{ alert: unknown }>(`${FOREX_PREFIX}/alerts/${encodeURIComponent(alertId)}`, body, fxRequestInit()),
  alertEvents: () => fxGet<{ count: number; events: Array<Record<string, unknown>> }>('/alerts/events'),
  alertDeliveryStatus: () =>
    fxGet<{ adapters: Array<{ channel?: string; status?: string; reason?: string }> }>('/alerts/delivery-status'),
  providersHealth: () => fxGet<{ source: string; providers: Array<{ status?: string }> }>('/providers/health', true),
  candles: (query: ForexCandleQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    params.set('symbol', query.symbol);
    if (query.timeframe) params.set('timeframe', query.timeframe);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.limit != null) params.set('limit', String(query.limit));
    return fxGet<ForexCandleResponse>(`/candles?${params.toString()}`, true, signal);
  },

  account: () => fxGet<{ source: string; account: ForexAccountView; calculationStatus?: string }>('/account'),
  setPositionMode: (body: { mode: 'NETTING' | 'HEDGING' }) =>
    api.post<{
      source: string;
      positionMode: 'NETTING' | 'HEDGING';
      previousMode: 'NETTING' | 'HEDGING';
      account: ForexAccountView;
    }>(`${FOREX_PREFIX}/account/position-mode`, body, fxRequestInit()),
  balance: () =>
    fxGet<{
      source: string;
      currency: string;
      ledgerBalance: string;
      availableBalance: string;
      equity: string;
      calculationStatus: string;
    }>('/balance'),
  equity: () =>
    fxGet<{
      source: string;
      currency: string;
      equity: string;
      ledgerBalance: string;
      unrealizedPnl: string;
      calculationStatus: string;
    }>('/equity'),
  pnl: () => fxGet<{ source: string; pnl: ForexPnlView }>('/pnl'),
  margin: () => fxGet<{ source: string; valuationKind: string; margin: ForexMarginSnapshot }>('/margin'),
  risk: () => fxGet<{ source: string; valuationKind: string; risk: unknown }>('/risk'),
  riskStatus: () => fxGet<ForexRiskStatus>('/risk/status'),
  riskSummary: () => fxGet<Pick<ForexRiskStatus, 'state' | 'reason' | 'exposure' | 'margin' | 'dealing'> & { source: string }>(
    '/risk/summary'
  ),
  exposure: () => fxGet<Record<string, unknown>>('/exposure'),
  orders: () => fxGet<{ source: string; count: number; orders: ForexPublicOrder[] }>('/orders'),
  ordersPending: () => fxGet<{ source: string; count: number; orders: ForexPublicOrder[] }>('/orders/pending'),
  pendingOrders: () => fxGet<{ source: string; count: number; orders: ForexPublicOrder[] }>('/pending-orders'),
  order: (orderId: string) => fxGet<{ source: string; order: ForexPublicOrder }>(`/orders/${encodeURIComponent(orderId)}`),
  positions: () => fxGet<{ source: string; count: number; positions: ForexPublicPosition[] }>('/positions'),
  position: (positionId: string) =>
    fxGet<{ source: string; position: ForexPublicPosition }>(`/positions/${encodeURIComponent(positionId)}`),
  fills: () => fxGet<{ source: string; count: number; fills: ForexFillRow[] }>('/fills'),
  trades: () => fxGet<{ source: string; count: number; trades: ForexFillRow[] }>('/trades'),
  protections: () =>
    fxGet<{ source: string; count: number; protections: ForexPublicProtection[] }>('/protections'),
  /** Append-only server journal, account-scoped. Absent on pre-Phase-A backends. */
  journal: (limit = 100, signal?: AbortSignal) =>
    fxGet<{
      source: string;
      executionMode: string;
      origin: 'SERVER';
      limit: number;
      maxLimit: number;
      count: number;
      events: ForexServerJournalEvent[];
    }>(`/journal?limit=${encodeURIComponent(String(limit))}`, false, signal),
  fees: () => fxGet<{ source: string; currency: string; fees: unknown; count: number; transactions: ForexLedgerRow[] }>('/fees'),
  swaps: () =>
    fxGet<{
      source: string;
      currency: string;
      swaps: unknown;
      count: number;
      history: unknown[];
      transactions: ForexLedgerRow[];
    }>('/swaps'),
  ledger: () =>
    fxGet<{ source: string; count: number; transactions: ForexLedgerRow[]; reconciliation?: ForexLedgerReconciliation }>(
      '/ledger'
    ),
  funding: () => fxGet<{ source: string; count: number; transactions: ForexLedgerRow[] }>('/funding'),
  /** SIMULATED / MOCK demo credit only. Never touches Crypto. */
  claimDemoFunds: (body?: { idempotencyKey?: string }) =>
    api.post<{
      source: string;
      executionMode: string;
      scope: string;
      realForex: boolean;
      transaction: ForexLedgerRow;
    }>(`${FOREX_PREFIX}/funding/demo`, body ?? {}, fxRequestInit()),
  /** DEMO / MOCK only. Pins Bid=Ask and moves the simulated quote. */
  applyDemoPrice: (body: { symbol: string; price: string }) =>
    api.post<{
      source: string;
      executionMode: string;
      scope: string;
      realForex: boolean;
      quote: ForexQuoteDto;
    }>(`${FOREX_PREFIX}/market-data/demo-price`, body, fxRequestInit()),
  /** DEMO / MOCK only. Clears temporary mid pin(s) so the anchored walk resumes. */
  clearDemoPrice: (body?: { symbol?: string }) =>
    api.post<{
      source: string;
      executionMode: string;
      scope: string;
      realForex: boolean;
      cleared: string[];
    }>(`${FOREX_PREFIX}/market-data/demo-price/clear`, body ?? {}, fxRequestInit()),
  liquidation: () => fxGet<Record<string, unknown>>('/liquidation'),
  news: () => fxGet<{ source: string; provider: string; availability: string; reason?: string; count: number; items: unknown[] }>('/news', true),
  calendar: () =>
    fxGet<{ source: string; provider: string; availability: string; reason?: string; count: number; events: unknown[] }>(
      '/calendar',
      true
    ),

  previewOrder: (body: ForexPreviewRequest, signal?: AbortSignal) =>
    api.post<ForexPreviewResponse>(`${FOREX_PREFIX}/orders/preview`, body, fxRequestInit({ signal })),
  placeOrder: (body: ForexPlaceOrderBody) =>
    api.post<{ source: string; executionMode: string; order: ForexPublicOrder }>(
      `${FOREX_PREFIX}/orders`,
      body,
      fxRequestInit()
    ),
  closePosition: (positionId: string, body: ForexClosePositionBody) =>
    api.post<ForexClosePositionResult>(
      `${FOREX_PREFIX}/positions/${encodeURIComponent(positionId)}/close`,
      body,
      fxRequestInit()
    ),
  closeBy: (body: ForexCloseByBody) =>
    api.post<ForexCloseByResult>(`${FOREX_PREFIX}/positions/close-by`, body, fxRequestInit()),
  reversePosition: (positionId: string, body: ForexReverseBody) =>
    api.post<ForexReverseResult>(
      `${FOREX_PREFIX}/positions/${encodeURIComponent(positionId)}/reverse`,
      body,
      fxRequestInit()
    ),
  createProtection: (body: ForexCreateProtectionBody) =>
    api.post<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections`,
      body,
      fxRequestInit()
    ),
  updateProtection: (
    protectionId: string,
    body: { triggerPrice?: string; trailingDistance?: string | null }
  ) =>
    api.patch<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections/${encodeURIComponent(protectionId)}`,
      body,
      fxRequestInit()
    ),
  cancelProtection: (protectionId: string) =>
    api.delete<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections/${encodeURIComponent(protectionId)}`,
      fxRequestInit()
    ),
  cancelOrder: (orderId: string) =>
    api.post<{ source: string; order: ForexPublicOrder }>(
      `${FOREX_PREFIX}/orders/${encodeURIComponent(orderId)}/cancel`,
      undefined,
      fxRequestInit()
    ),
  modifyOrder: (orderId: string, body: ForexModifyOrderBody) =>
    api.patch<{ source: string; executionMode: string; order: ForexPublicOrder }>(
      `${FOREX_PREFIX}/orders/${encodeURIComponent(orderId)}`,
      body,
      fxRequestInit()
    ),
  /** Authenticated CSV download (same account as session). */
  historyExportCsvUrl: (kind: 'orders' | 'fills' | 'ledger') =>
    `${FOREX_PREFIX}/history/export/${kind}`,
};

export async function downloadForexHistoryCsv(kind: 'orders' | 'fills' | 'ledger'): Promise<void> {
  const url = `${getApiBaseUrl()}${forexApi.historyExportCsvUrl(kind)}`;
  const headers = getForexActiveAccountHeaders();
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `forex-${kind}.csv`;
  a.click();
  URL.revokeObjectURL(href);
}
