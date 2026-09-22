'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { sanitizeIncomingTradesForSymbol } from './tradeStreamSanitizer';
import {
  useSpotWs,
  normalizeTradeMessage,
  normalizeTickerMessage,
  type OrderbookSnapshot,
  type OrderUpdateMessage,
  type TickerMessage,
  type TradeMessage,
  type SpotWsStreamPhase,
} from '@/hooks/useSpotWs';
import type { OrderbookDeltaPayload } from '@/lib/orderbookDelta';
import { applyOrderbookDelta } from '@/lib/orderbookDelta';

type OrderbookCtxType = {
  orderbook: OrderbookSnapshot | null;
  orderbookLoading: boolean;
};

type TickerCtxType = {
  ticker: TickerMessage | null;
};

type TradesCtxType = {
  recentTrades: TradeMessage[];
};

export type BootstrapIssueId =
  | 'orderbookDelayed'
  | 'tradeResyncDelayed'
  | 'orderbookSnapshotUnavailable'
  | 'tickerUnavailable';

type StreamCtxType = {
  connected: boolean;
  privateChannelsReady: boolean;
  reconnectAttempt: number;
  streamPhase: SpotWsStreamPhase;
  lastRttMs: number | null;
  liteMode: boolean;
  liteHint: string;
  bootstrapIssue: BootstrapIssueId | null;
};

const OrderbookCtx = createContext<OrderbookCtxType | null>(null);
const TickerCtx = createContext<TickerCtxType | null>(null);
const TradesCtx = createContext<TradesCtxType | null>(null);
const StreamCtx = createContext<StreamCtxType | null>(null);

const MAX_TRADES = 50;

type SpotOrderbookRestRow = { price: string; quantity: string };
type SpotOrderbookRestPayload = {
  bids: SpotOrderbookRestRow[];
  asks: SpotOrderbookRestRow[];
  lastUpdateId?: number;
};

function sanitizeOrderbookRows(rows: Array<{ price: string; quantity: string } | { price: unknown; quantity: unknown }>): SpotOrderbookRestRow[] {
  const out: SpotOrderbookRestRow[] = [];
  for (const row of rows ?? []) {
    const priceRaw = typeof row.price === 'string' ? row.price : String(row.price ?? '');
    const qtyRaw = typeof row.quantity === 'string' ? row.quantity : String(row.quantity ?? '');
    const p = Number(priceRaw);
    const q = Number(qtyRaw);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0) continue;
    out.push({ price: priceRaw, quantity: qtyRaw });
  }
  return out;
}

function sanitizeOrderbookSnapshot(snap: OrderbookSnapshot): OrderbookSnapshot {
  return {
    ...snap,
    bids: sanitizeOrderbookRows((snap.bids as Array<{ price: unknown; quantity: unknown }>) ?? []),
    asks: sanitizeOrderbookRows((snap.asks as Array<{ price: unknown; quantity: unknown }>) ?? []),
  };
}

function tradeTimeMs(row: TradeMessage): number {
  const ts = Date.parse(row.time);
  return Number.isFinite(ts) ? ts : 0;
}

function sortTradesNewestFirst(rows: TradeMessage[]): TradeMessage[] {
  return [...rows].sort((a, b) => {
    const dt = tradeTimeMs(b) - tradeTimeMs(a);
    if (dt !== 0) return dt;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
}

function mergeTrades(prev: TradeMessage[], incoming: TradeMessage[]): { next: TradeMessage[]; changed: boolean } {
  if (!incoming.length) return { next: prev, changed: false };
  const prevIds = new Set(prev.map((t) => t.id).filter(Boolean));
  const newOnes = incoming.filter((t) => t.id && !prevIds.has(t.id));
  const sortAndClip = (rows: TradeMessage[]) => sortTradesNewestFirst(rows).slice(0, MAX_TRADES);
  if (newOnes.length > 0) {
    return { next: sortAndClip([...newOnes, ...prev]), changed: true };
  }
  const incomingNormalized = sortAndClip(incoming);
  if (prev.length && incomingNormalized[0]?.id === prev[0]?.id && incomingNormalized.length === prev.length) {
    return { next: prev, changed: false };
  }
  return { next: incomingNormalized, changed: true };
}

function mergeTicker(prev: TickerMessage | null, data: TickerMessage): TickerMessage {
  if (!prev) return { ...data };
  return {
    ...prev,
    last_price: data.last_price ?? prev.last_price,
    bid: data.bid ?? prev.bid,
    ask: data.ask ?? prev.ask,
    volume_24h: data.volume_24h ?? prev.volume_24h,
    base_volume_24h: data.base_volume_24h ?? prev.base_volume_24h,
    open_24h: data.open_24h ?? prev.open_24h,
    high_24h: data.high_24h ?? prev.high_24h,
    low_24h: data.low_24h ?? prev.low_24h,
    price_change_pct_24h:
      data.price_change_pct_24h !== undefined ? data.price_change_pct_24h : prev.price_change_pct_24h,
    change_pct: data.change_pct !== undefined ? data.change_pct : prev.change_pct,
    status: data.status ?? prev.status,
  };
}

function tickerVisualEqual(a: TickerMessage | null, b: TickerMessage | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.last_price === b.last_price &&
    a.bid === b.bid &&
    a.ask === b.ask &&
    a.volume_24h === b.volume_24h &&
    a.base_volume_24h === b.base_volume_24h &&
    a.open_24h === b.open_24h &&
    a.high_24h === b.high_24h &&
    a.low_24h === b.low_24h &&
    a.price_change_pct_24h === b.price_change_pct_24h &&
    a.change_pct === b.change_pct &&
    a.status === b.status
  );
}

export interface SpotMarketDataProviderProps {
  symbol: string;
  isAuth: boolean;
  children: ReactNode;
  onOrderActivity?: () => void;
  onUserTradeActivity?: () => void;
  /** Optional: e.g. toasts for partial/fill from `order_update` WS messages. */
  onOrderStreamStatus?: (data: OrderUpdateMessage) => void;
}

export function SpotMarketDataProvider({
  symbol,
  isAuth,
  children,
  onOrderActivity,
  onUserTradeActivity,
  onOrderStreamStatus,
}: SpotMarketDataProviderProps) {
  const [orderbook, setOrderbook] = useState<OrderbookSnapshot | null>(null);
  const [orderbookLoading, setOrderbookLoading] = useState(true);
  const [ticker, setTicker] = useState<TickerMessage | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeMessage[]>([]);

  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const lastSeqRef = useRef<number | null>(null);
  const lastTradesFeedSeqRef = useRef<number | null>(null);
  /** Authoritative book for merges; do not mirror React state each render (would race rAF). */
  const committedOrderbookRef = useRef<OrderbookSnapshot | null>(null);
  /** Re-subscribe orderbook channel to force a fresh WS snapshot when REST lacks seq. */
  const orderbookResubscribeRef = useRef<() => void>(() => {});
  const orderbookResyncInFlightRef = useRef<Promise<void> | null>(null);
  const [adaptiveUiMode, setAdaptiveUiMode] = useState<'normal' | 'eco' | 'minimal'>('normal');
  const [adaptiveHint, setAdaptiveHint] = useState('');
  const [bootstrapIssue, setBootstrapIssue] = useState<BootstrapIssueId | null>(null);

  const pendingTickerRef = useRef<TickerMessage | null>(null);
  const pendingTradesRef = useRef<TradeMessage[] | null>(null);
  const tradesCommitRef = useRef<TradeMessage[]>([]);
  const dirtyOrderbookRef = useRef(false);
  const dirtyTickerRef = useRef(false);
  const dirtyTradesRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const orderActivityRef = useRef(onOrderActivity);
  orderActivityRef.current = onOrderActivity;
  const userTradeActivityRef = useRef(onUserTradeActivity);
  userTradeActivityRef.current = onUserTradeActivity;
  const orderStreamStatusRef = useRef(onOrderStreamStatus);
  orderStreamStatusRef.current = onOrderStreamStatus;

  const flushRaf = useCallback(() => {
    rafRef.current = null;
    if (dirtyOrderbookRef.current && committedOrderbookRef.current) {
      setOrderbook(committedOrderbookRef.current);
      dirtyOrderbookRef.current = false;
    }
    if (dirtyTickerRef.current && pendingTickerRef.current) {
      const next = pendingTickerRef.current;
      setTicker((prev) => {
        const merged = mergeTicker(prev, next);
        return tickerVisualEqual(prev, merged) ? prev : merged;
      });
      dirtyTickerRef.current = false;
      pendingTickerRef.current = null;
    }
    if (dirtyTradesRef.current && pendingTradesRef.current) {
      setRecentTrades(pendingTradesRef.current);
      dirtyTradesRef.current = false;
      pendingTradesRef.current = null;
    }
  }, []);

  const scheduleRaf = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushRaf);
  }, [flushRaf]);

  const resnapshotOrderbook = useCallback(async () => {
    const sym = symbolRef.current;
    if (!sym) return;
    if (orderbookResyncInFlightRef.current) {
      await orderbookResyncInFlightRef.current;
      return;
    }
    const run = (async () => {
      try {
        const res = await api.get<SpotOrderbookRestPayload>(
          `/api/v1/spot/orderbook/${encodeURIComponent(sym)}?limit=50`,
          { notifyOnError: false, skipAuth: true }
        );
        if (!res.success || !res.data || symbolRef.current !== sym) return;
        const id = res.data.lastUpdateId;
        if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
          orderbookResubscribeRef.current();
          return;
        }
        const snap: OrderbookSnapshot = {
          symbol: sym,
          bids: res.data.bids ?? [],
          asks: res.data.asks ?? [],
          lastUpdateId: id,
        };
        setBootstrapIssue(null);
        lastSeqRef.current = id;
        committedOrderbookRef.current = snap;
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        dirtyOrderbookRef.current = false;
        queueMicrotask(() => {
        if (sym === symbolRef.current) setOrderbook(sanitizeOrderbookSnapshot(snap));
        });
      } catch {
        setBootstrapIssue('orderbookDelayed');
      }
    })();
    orderbookResyncInFlightRef.current = run;
    try {
      await run;
    } finally {
      orderbookResyncInFlightRef.current = null;
    }
  }, []);

  const resyncTradesFromRest = useCallback(async () => {
    const sym = symbolRef.current;
    if (!sym) return;
    try {
      const res = await api.get<
        Array<{ id?: string; market?: string; side?: string; price?: string; quantity?: string; time?: string; created_at?: string }>
      >(`/api/v1/spot/recent-trades/${encodeURIComponent(sym)}?limit=50`, {
        notifyOnError: false,
        skipAuth: true,
      });
      if (!res.success || !Array.isArray(res.data) || symbolRef.current !== sym) return;
      const mapped = res.data.map((row) => normalizeTradeMessage(row));
      setBootstrapIssue(null);
      tradesCommitRef.current = mapped;
      lastTradesFeedSeqRef.current = null;
      pendingTradesRef.current = mapped;
      dirtyTradesRef.current = true;
      scheduleRaf();
    } catch {
      setBootstrapIssue('tradeResyncDelayed');
    }
  }, [scheduleRaf]);

  const { subscribe, unsubscribe, connected, privateChannelsReady, reconnectAttempt, streamPhase, lastRttMs } = useSpotWs({
    onOrderbook: (data, type) => {
      if (data.symbol !== symbolRef.current) return;
      if (type === 'orderbook_snapshot') {
        const safeData = sanitizeOrderbookSnapshot(data);
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        dirtyOrderbookRef.current = false;
        lastSeqRef.current = safeData.lastUpdateId ?? null;
        committedOrderbookRef.current = safeData;
        queueMicrotask(() => {
          if (safeData.symbol === symbolRef.current) setOrderbook(safeData);
        });
        return;
      }
      const safeData = sanitizeOrderbookSnapshot(data);
      lastSeqRef.current = safeData.lastUpdateId ?? lastSeqRef.current;
      committedOrderbookRef.current = safeData;
      dirtyOrderbookRef.current = true;
      scheduleRaf();
    },
    onOrderbookDelta: (delta: OrderbookDeltaPayload) => {
      if (delta.symbol !== symbolRef.current) return;
      const cur = committedOrderbookRef.current;
      if (!cur) {
        void resnapshotOrderbook();
        return;
      }
      const expected = lastSeqRef.current;
      if (expected == null) {
        orderbookResubscribeRef.current();
        void resnapshotOrderbook();
        return;
      }
      if (delta.seq === expected) {
        return;
      }
      if (delta.seq < expected) {
        void resnapshotOrderbook();
        return;
      }
      if (delta.seq !== expected + 1) {
        void resnapshotOrderbook();
        return;
      }
      const merged = sanitizeOrderbookSnapshot(applyOrderbookDelta(cur, delta));
      lastSeqRef.current = delta.seq;
      committedOrderbookRef.current = merged;
      dirtyOrderbookRef.current = true;
      scheduleRaf();
    },
    onTicker: (data) => {
      if (data.symbol !== symbolRef.current) return;
      pendingTickerRef.current = data;
      dirtyTickerRef.current = true;
      scheduleRaf();
    },
    onTrades: (data, meta) => {
      const sym = symbolRef.current;
      if (!sym) return;
      const seq = meta?.feed_seq;
      if (meta?.throttled) {
        if (typeof seq === 'number' && Number.isFinite(seq)) {
          lastTradesFeedSeqRef.current = seq;
        }
        return;
      }
      const scoped = sanitizeIncomingTradesForSymbol(data, sym);
      if (typeof seq === 'number' && Number.isFinite(seq)) {
        const last = lastTradesFeedSeqRef.current;
        if (last != null) {
          if (seq < last) {
            void resyncTradesFromRest();
            return;
          }
          if (seq > last + 1) {
            const symAtGap = sym;
            void resyncTradesFromRest().then(() => {
              if (symbolRef.current !== symAtGap) return;
              lastTradesFeedSeqRef.current = seq;
              const { next, changed } = mergeTrades(tradesCommitRef.current, scoped);
              if (!changed) return;
              tradesCommitRef.current = next;
              pendingTradesRef.current = next;
              dirtyTradesRef.current = true;
              scheduleRaf();
            });
            return;
          }
        }
        lastTradesFeedSeqRef.current = seq;
      }
      const { next, changed } = mergeTrades(tradesCommitRef.current, scoped);
      if (!changed) return;
      tradesCommitRef.current = next;
      pendingTradesRef.current = next;
      dirtyTradesRef.current = true;
      scheduleRaf();
    },
    onOrderUpdate: (data) => {
      queueMicrotask(() => orderActivityRef.current?.());
      queueMicrotask(() => orderStreamStatusRef.current?.(data));
    },
    onTradeUpdate: () => {
      queueMicrotask(() => userTradeActivityRef.current?.());
    },
    onAdaptiveMode: (p) => {
      setAdaptiveUiMode(p.ui_mode);
      setAdaptiveHint(typeof p.hint === 'string' ? p.hint : '');
    },
  });

  useEffect(() => {
    orderbookResubscribeRef.current = () => {
      const sym = symbolRef.current;
      if (!sym) return;
      const ch = `orderbook:${sym}`;
      unsubscribe(ch);
      subscribe(ch);
    };
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    if (!symbol) return;
    const ac = new AbortController();
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    dirtyOrderbookRef.current = false;
    dirtyTickerRef.current = false;
    dirtyTradesRef.current = false;
    pendingTickerRef.current = null;
    pendingTradesRef.current = null;
    lastSeqRef.current = null;
    lastTradesFeedSeqRef.current = null;
    tradesCommitRef.current = [];
    setBootstrapIssue(null);
    setOrderbook(null);
    setOrderbookLoading(true);
    setTicker(null);
    setRecentTrades([]);
    void resyncTradesFromRest();

    const currentSymbol = symbol;
    api.get<SpotOrderbookRestPayload>(`/api/v1/spot/orderbook/${encodeURIComponent(symbol)}?limit=20`, {
      signal: ac.signal,
      notifyOnError: false,
      skipAuth: true,
    })
      .then((res) => {
        if (ac.signal.aborted) return;
        if (res.success && res.data && currentSymbol === symbolRef.current) {
          const id = res.data.lastUpdateId;
          const snap: OrderbookSnapshot = {
            symbol: currentSymbol,
            bids: sanitizeOrderbookRows((res.data.bids as Array<{ price: unknown; quantity: unknown }>) ?? []),
            asks: sanitizeOrderbookRows((res.data.asks as Array<{ price: unknown; quantity: unknown }>) ?? []),
            ...(typeof id === 'number' && Number.isFinite(id) && id > 0 ? { lastUpdateId: id } : {}),
          };
          committedOrderbookRef.current = snap;
          setBootstrapIssue(null);
          if (typeof id === 'number' && Number.isFinite(id) && id > 0) {
            lastSeqRef.current = id;
          }
          setOrderbook(snap);
          if (!(typeof id === 'number' && Number.isFinite(id) && id > 0)) {
            queueMicrotask(() => orderbookResubscribeRef.current());
          }
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setBootstrapIssue('orderbookSnapshotUnavailable');
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setOrderbookLoading(false);
      });

    api.get<{
      last_price: string | null;
      bid: string | null;
      ask: string | null;
      volume_24h?: string;
      base_volume_24h?: string;
      open_24h?: string | null;
      high_24h?: string;
      low_24h?: string;
      change_pct?: number | null;
      status?: string;
    }>(`/api/v1/spot/ticker/${encodeURIComponent(symbol)}`, {
      signal: ac.signal,
      notifyOnError: false,
      skipAuth: true,
    })
      .then((res) => {
        if (ac.signal.aborted) return;
        if (res.success && res.data && currentSymbol === symbolRef.current) {
          setBootstrapIssue(null);
          setTicker(
            normalizeTickerMessage({
              symbol: currentSymbol,
              last_price: res.data.last_price,
              bid: res.data.bid,
              ask: res.data.ask,
              volume_24h: res.data.volume_24h,
              base_volume_24h: res.data.base_volume_24h,
              open_24h: res.data.open_24h ?? null,
              high_24h: res.data.high_24h,
              low_24h: res.data.low_24h,
              change_pct: res.data.change_pct ?? null,
              status: res.data.status,
            })
          );
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setBootstrapIssue('tickerUnavailable');
        }
      });

    return () => ac.abort();
  }, [symbol]);

  useEffect(() => {
    if (!connected || !symbol) return;
    void resyncTradesFromRest();
  }, [connected, symbol, resyncTradesFromRest]);

  useEffect(() => {
    if (!symbol || !connected) return;
    subscribe(`orderbook:${symbol}`);
    subscribe(`ticker:${symbol}`);
    subscribe(`trades:${symbol}`);
    if (isAuth) {
      subscribe('user.orders');
      subscribe('user.trades');
    }
    return () => {
      unsubscribe(`orderbook:${symbol}`);
      unsubscribe(`ticker:${symbol}`);
      unsubscribe(`trades:${symbol}`);
      if (isAuth) {
        unsubscribe('user.orders');
        unsubscribe('user.trades');
      }
    };
  }, [symbol, connected, isAuth, subscribe, unsubscribe]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const obValue = useMemo(() => ({ orderbook, orderbookLoading }), [orderbook, orderbookLoading]);
  const tkValue = useMemo(() => ({ ticker }), [ticker]);
  const trValue = useMemo(() => ({ recentTrades }), [recentTrades]);
  const liteMode = adaptiveUiMode !== 'normal';
  const stValue = useMemo(
    () => ({
      connected,
      privateChannelsReady,
      reconnectAttempt,
      streamPhase,
      lastRttMs,
      liteMode,
      liteHint: adaptiveHint,
      bootstrapIssue,
    }),
    [connected, privateChannelsReady, reconnectAttempt, streamPhase, lastRttMs, liteMode, adaptiveHint, bootstrapIssue]
  );

  return (
    <StreamCtx.Provider value={stValue}>
      <OrderbookCtx.Provider value={obValue}>
        <TickerCtx.Provider value={tkValue}>
          <TradesCtx.Provider value={trValue}>{children}</TradesCtx.Provider>
        </TickerCtx.Provider>
      </OrderbookCtx.Provider>
    </StreamCtx.Provider>
  );
}

export function useSpotMarketOrderbook(): OrderbookCtxType {
  const ctx = useContext(OrderbookCtx);
  if (!ctx) throw new Error('useSpotMarketOrderbook must be used within SpotMarketDataProvider');
  return ctx;
}

export function useSpotMarketTicker(): TickerCtxType {
  const ctx = useContext(TickerCtx);
  if (!ctx) throw new Error('useSpotMarketTicker must be used within SpotMarketDataProvider');
  return ctx;
}

export function useSpotMarketTrades(): TradesCtxType {
  const ctx = useContext(TradesCtx);
  if (!ctx) throw new Error('useSpotMarketTrades must be used within SpotMarketDataProvider');
  return ctx;
}

export function useSpotMarketStream(): StreamCtxType {
  const ctx = useContext(StreamCtx);
  if (!ctx) throw new Error('useSpotMarketStream must be used within SpotMarketDataProvider');
  return ctx;
}
