import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import type {
  SpotMarket,
  SpotTicker,
  SpotTickerDetail,
  OrderbookSnapshot,
  RecentTrade,
  Candle,
  PlaceOrderRequest,
  SpotOrder,
  CancelAllResult,
  MarketIntelligencePayload,
} from '@exchange/mobile-types';

function norm(symbol: string) {
  return symbol.toUpperCase().replace(/-/g, '_');
}

export class SpotRepository extends BaseRepository {
  getMarkets() {
    return this.http.request<SpotMarket[]>('/spot/markets', { method: 'GET', skipAuth: true });
  }

  getMarketIntelligence() {
    return this.http.request<MarketIntelligencePayload>('/spot/markets/intelligence', {
      method: 'GET',
      skipAuth: true,
    });
  }

  getTickers() {
    return this.http.request<SpotTicker[]>('/spot/tickers', { method: 'GET', skipAuth: true });
  }

  getTicker(symbol: string) {
    return this.http.request<SpotTickerDetail>(`/spot/ticker/${norm(symbol)}`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getOrderbook(symbol: string, depth = 20) {
    return this.http.request<OrderbookSnapshot>(`/spot/orderbook/${norm(symbol)}?depth=${depth}`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getRecentTrades(symbol: string, limit = 50) {
    return this.http.request<RecentTrade[]>(`/spot/recent-trades/${norm(symbol)}?limit=${limit}`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getCandles(symbol: string, interval: number, limit = 200) {
    return this.http.request<Candle[]>(
      `/trading/candles/${norm(symbol)}?interval=${interval}&limit=${limit}`,
      { method: 'GET', skipAuth: true },
    );
  }

  getWsTicket() {
    return this.http.request<{ ticket: string; expiresIn: number }>('/spot/ws-ticket', {
      method: 'POST',
      body: {},
    });
  }

  placeOrder(body: PlaceOrderRequest) {
    return this.http.request<SpotOrder>('/spot/order', {
      method: 'POST',
      body: { ...body, market: norm(body.market) },
      idempotent: true,
    });
  }

  cancelOrder(orderId: string) {
    return this.http.request<SpotOrder>(`/spot/order/${orderId}/cancel`, { method: 'POST', body: {} });
  }

  cancelAllOrders(market: string) {
    return this.http.request<CancelAllResult>('/spot/orders/cancel-all', {
      method: 'POST',
      body: { market: norm(market) },
    });
  }

  getOpenOrders() {
    return this.http.request<SpotOrder[]>('/spot/open-orders', { method: 'GET' });
  }

  getOrderHistory(params?: { page?: number; limit?: number; market?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.market) q.set('market', norm(params.market));
    const suffix = q.toString() ? `?${q}` : '';
    return this.http.request<SpotOrder[]>(`/spot/order-history${suffix}`, { method: 'GET' });
  }

  listOrders(params: { status?: string; limit?: number; cursor?: string }) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    q.set('limit', String(params.limit ?? 100));
    if (params.cursor) q.set('cursor', params.cursor);
    return this.http.request<{ orders: SpotOrder[]; next_cursor?: string | null }>(
      `/spot/orders?${q}`,
      { method: 'GET' },
    );
  }

  getTradeHistory(params?: { page?: number; limit?: number; market?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.market) q.set('market', norm(params.market));
    const suffix = q.toString() ? `?${q}` : '';
    return this.http.request<RecentTrade[]>(`/spot/trade-history${suffix}`, { method: 'GET' });
  }
}

let spotRepository: SpotRepository | null = null;

export function getSpotRepository(): SpotRepository {
  if (!spotRepository) {
    spotRepository = new SpotRepository(getHttpClient());
  }
  return spotRepository;
}
