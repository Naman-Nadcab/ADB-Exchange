import { api } from '@/lib/api';
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

export type ForexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ForexError; statusHint?: string };

export function unwrap<T>(res: { success: boolean; data?: T; error?: { code?: string; message?: string; source?: string } }): ForexResult<T> {
  if (res.success && res.data !== undefined) return { ok: true, data: res.data };
  const error = normalizeForexError(res.error ?? res);
  return { ok: false, error: { ...error, message: describeForexError(error) } };
}

function fxGet<T>(path: string, skipAuth = false, signal?: AbortSignal) {
  return api.get<T>(`${FOREX_PREFIX}${path}`, { skipAuth, notifyOnError: false, signal });
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
    }>(`${FOREX_PREFIX}/account/position-mode`, body, { notifyOnError: false }),
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
    }>(`${FOREX_PREFIX}/funding/demo`, body ?? {}, { notifyOnError: false }),
  /** DEMO / MOCK only. Pins Bid=Ask and moves the simulated quote. */
  applyDemoPrice: (body: { symbol: string; price: string }) =>
    api.post<{
      source: string;
      executionMode: string;
      scope: string;
      realForex: boolean;
      quote: ForexQuoteDto;
    }>(`${FOREX_PREFIX}/market-data/demo-price`, body, { notifyOnError: false }),
  /** DEMO / MOCK only. Clears temporary mid pin(s) so the anchored walk resumes. */
  clearDemoPrice: (body?: { symbol?: string }) =>
    api.post<{
      source: string;
      executionMode: string;
      scope: string;
      realForex: boolean;
      cleared: string[];
    }>(`${FOREX_PREFIX}/market-data/demo-price/clear`, body ?? {}, { notifyOnError: false }),
  liquidation: () => fxGet<Record<string, unknown>>('/liquidation'),
  news: () => fxGet<{ source: string; provider: string; availability: string; reason?: string; count: number; items: unknown[] }>('/news', true),
  calendar: () =>
    fxGet<{ source: string; provider: string; availability: string; reason?: string; count: number; events: unknown[] }>(
      '/calendar',
      true
    ),

  previewOrder: (body: ForexPreviewRequest, signal?: AbortSignal) =>
    api.post<ForexPreviewResponse>(`${FOREX_PREFIX}/orders/preview`, body, {
      notifyOnError: false,
      signal,
    }),
  placeOrder: (body: ForexPlaceOrderBody) =>
    api.post<{ source: string; executionMode: string; order: ForexPublicOrder }>(`${FOREX_PREFIX}/orders`, body, {
      notifyOnError: false,
    }),
  closePosition: (positionId: string, body: ForexClosePositionBody) =>
    api.post<ForexClosePositionResult>(`${FOREX_PREFIX}/positions/${encodeURIComponent(positionId)}/close`, body, {
      notifyOnError: false,
    }),
  closeBy: (body: ForexCloseByBody) =>
    api.post<ForexCloseByResult>(`${FOREX_PREFIX}/positions/close-by`, body, { notifyOnError: false }),
  reversePosition: (positionId: string, body: ForexReverseBody) =>
    api.post<ForexReverseResult>(`${FOREX_PREFIX}/positions/${encodeURIComponent(positionId)}/reverse`, body, {
      notifyOnError: false,
    }),
  createProtection: (body: ForexCreateProtectionBody) =>
    api.post<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections`,
      body,
      { notifyOnError: false }
    ),
  updateProtection: (
    protectionId: string,
    body: { triggerPrice?: string; trailingDistance?: string | null }
  ) =>
    api.patch<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections/${encodeURIComponent(protectionId)}`,
      body,
      { notifyOnError: false }
    ),
  cancelProtection: (protectionId: string) =>
    api.delete<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections/${encodeURIComponent(protectionId)}`,
      { notifyOnError: false }
    ),
  cancelOrder: (orderId: string) =>
    api.post<{ source: string; order: ForexPublicOrder }>(
      `${FOREX_PREFIX}/orders/${encodeURIComponent(orderId)}/cancel`,
      undefined,
      { notifyOnError: false }
    ),
  modifyOrder: (orderId: string, body: ForexModifyOrderBody) =>
    api.patch<{ source: string; executionMode: string; order: ForexPublicOrder }>(
      `${FOREX_PREFIX}/orders/${encodeURIComponent(orderId)}`,
      body,
      { notifyOnError: false }
    ),
};
