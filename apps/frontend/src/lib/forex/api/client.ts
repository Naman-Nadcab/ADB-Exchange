import { api } from '@/lib/api';
import { describeForexError, normalizeForexError } from '../models/errors';
import type { ForexCandleQuery, ForexCandleResponse } from '../models/candles';
import type { ForexPreviewRequest, ForexPreviewResponse } from '../models/preview';
import type {
  ForexAccountView,
  ForexClosePositionBody,
  ForexClosePositionResult,
  ForexCreateProtectionBody,
  ForexError,
  ForexFillRow,
  ForexInstrument,
  ForexLedgerRow,
  ForexMarginSnapshot,
  ForexPlaceOrderBody,
  ForexPnlView,
  ForexPublicOrder,
  ForexPublicPosition,
  ForexPublicProtection,
  ForexQuoteDto,
  ForexRiskStatus,
  ForexSessionSnapshot,
  ForexTradingConfig,
} from '../models/types';
import { FOREX_PREFIX } from '../models/types';

export type ForexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ForexError; statusHint?: string };

function unwrap<T>(res: { success: boolean; data?: T; error?: { code?: string; message?: string; source?: string } }): ForexResult<T> {
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
  ledger: () => fxGet<{ source: string; count: number; transactions: ForexLedgerRow[] }>('/ledger'),
  funding: () => fxGet<{ source: string; count: number; transactions: ForexLedgerRow[] }>('/funding'),
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
  createProtection: (body: ForexCreateProtectionBody) =>
    api.post<{ source: string; executionMode: string; protection: ForexPublicProtection }>(
      `${FOREX_PREFIX}/protections`,
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
};

export { unwrap };
