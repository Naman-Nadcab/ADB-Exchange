import { useMarketDataStore } from '@core/state/marketDataStore';
import { normalizeSymbol, parseNum } from '@core/domain/markets/marketUtils';
import { applyOrderbookDelta } from '@core/domain/trade/orderbook';
import type { WsTickerPayload, OrderbookSnapshot, OrderbookDelta, RecentTrade } from '@exchange/mobile-types';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { appEventBus } from '@core/events/appEventBus';

export function handleTickerMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string; data?: WsTickerPayload };
  if (msg.type !== 'ticker' || !msg.data?.symbol) return;
  const symbol = normalizeSymbol(msg.data.symbol);
  useMarketDataStore.getState().setLiveTicker(symbol, {
    symbol,
    lastPrice: parseNum(msg.data.last_price),
    changePct: parseNum(msg.data.price_change_pct_24h),
    volume24h: parseNum(msg.data.volume_24h),
    high24h: parseNum(msg.data.high_24h),
    low24h: parseNum(msg.data.low_24h),
  });
}

function toSnapshot(data: Record<string, unknown>, symbol: string): OrderbookSnapshot {
  const bids = (data.bids as OrderbookSnapshot['bids']) ?? [];
  const asks = (data.asks as OrderbookSnapshot['asks']) ?? [];
  return {
    symbol: normalizeSymbol(String(data.symbol ?? symbol)),
    bids,
    asks,
    lastUpdateId: Number(data.lastUpdateId ?? data.seq ?? 0) || undefined,
    snapshotAtMs: Number(data.snapshotAtMs) || undefined,
  };
}

export function handleOrderbookMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string; channel?: string; data?: Record<string, unknown> };
  const channelSymbol = msg.channel?.replace('orderbook:', '') ?? '';
  const data = msg.data;
  if (!data) return;
  const symbol = normalizeSymbol(String(data.symbol ?? channelSymbol));

  if (msg.type === 'orderbook_snapshot' || msg.type === 'orderbook_update' || msg.type === 'orderbook_resync') {
    useMarketDataStore.getState().setOrderbook(symbol, toSnapshot(data, symbol));
    return;
  }

  if (msg.type === 'orderbook_delta') {
    const delta = data as unknown as OrderbookDelta;
    const store = useMarketDataStore.getState();
    const prev = store.orderbooks[symbol];
    const lastSeq = store.getLastSeq(symbol);
    if (lastSeq !== undefined && delta.seq <= lastSeq) return;
    if (lastSeq !== undefined && delta.seq > lastSeq + 1) {
      void getSpotRepository()
        .getOrderbook(symbol)
        .then((snap) => store.setOrderbook(symbol, { ...snap, symbol }));
      return;
    }
    if (prev) {
      store.setOrderbook(symbol, applyOrderbookDelta(prev, delta));
    } else {
      void getSpotRepository()
        .getOrderbook(symbol)
        .then((snap) => store.setOrderbook(symbol, { ...snap, symbol }));
    }
  }
}

export function handleTradesMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string; channel?: string; data?: RecentTrade[] };
  if (msg.type !== 'trades' || !Array.isArray(msg.data)) return;
  const symbol = normalizeSymbol(msg.channel?.replace('trades:', '') ?? msg.data[0]?.market ?? '');
  if (!symbol) return;
  useMarketDataStore.getState().appendTrades(symbol, msg.data);
}

export function handleUserOrderMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string };
  if (msg.type === 'order_update') {
    appEventBus.emit('orders:invalidate');
  }
}

export function handleUserTradeMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string };
  if (msg.type === 'trade') {
    appEventBus.emit('orders:invalidate');
    appEventBus.emit('balances:invalidate');
  }
}
