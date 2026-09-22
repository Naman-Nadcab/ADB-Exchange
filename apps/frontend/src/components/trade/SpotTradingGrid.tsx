'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useBalancesByAccount } from '@/lib/balances';
import { useSpotFavorites } from '@/hooks/useSpotFavorites';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from 'next-intl';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { SpotMarketDataProvider, useSpotMarketOrderbook, useSpotMarketTicker } from './SpotMarketDataContext';
import { SpotTradingGridTerminal } from './SpotTradingGridTerminal';
import type { OrderUpdateMessage } from '@/hooks/useSpotWs';
import { Skeleton } from '@/components/ui/Skeleton';
import { SPOT_TRADE_HREF } from '@/lib/tier1-canonical-routes';
import { useAuth } from '@/context/AuthContext';

type Market = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status?: string;
  maker_fee?: string;
  taker_fee?: string;
  min_qty?: string;
  min_notional?: string;
  price_precision?: number;
  qty_precision?: number;
  last_price?: string | null;
  volume_24h?: string | null;
  open_24h?: string | null;
  high_24h?: string | null;
  low_24h?: string | null;
  change_pct?: number | null;
};

type SpotGridOrderType = 'limit' | 'market' | 'stop_loss' | 'stop_limit' | 'trailing_stop_market';

type TradePreferences = {
  promptConfirmationOrders: boolean;
  promptCancelAllConfirmation: boolean;
};

const CHART_INTERVAL_LS_KEY = 'exchange.chart.intervalSeconds.v1';
const CHART_VIEW_MODE_LS_KEY = 'exchange.chart.viewMode.v1';
const SPOT_MARKETS_CACHE_KEY = 'exchange.spot.markets.cache.v1';
const SPOT_MARKETS_CACHE_TTL_MS = 30_000;
const SUPPORTED_CHART_INTERVALS = new Set([60, 300, 900, 1800, 3600, 14400, 86400]);

function toPositiveNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function spotOrderTypePlacementLabel(
  tr: ReturnType<typeof useTranslations<'crypto'>>,
  orderType: SpotGridOrderType
): string {
  switch (orderType) {
    case 'market':
      return tr('trading.market');
    case 'limit':
      return tr('trading.limit');
    case 'stop_loss':
      return tr('trading.stop');
    case 'stop_limit':
      return tr('orderTypes.stopLimitShort');
    case 'trailing_stop_market':
      return tr('trading.trailing');
    default:
      return orderType;
  }
}

function generateClientOrderId(): string {
  return crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type MarketPriceSnapshot = { last: number | null; bid: number | null; ask: number | null };

function SpotMarketPriceBridge({ onPrices }: { onPrices: (p: MarketPriceSnapshot) => void }) {
  const { ticker } = useSpotMarketTicker();
  const { orderbook } = useSpotMarketOrderbook();

  useEffect(() => {
    const lastRaw = ticker?.last_price;
    const last = lastRaw != null && String(lastRaw).trim() !== '' ? Number(lastRaw) : NaN;
    const bid = orderbook?.bids?.[0] ? Number(orderbook.bids[0].price) : NaN;
    const ask = orderbook?.asks?.[0] ? Number(orderbook.asks[0].price) : NaN;
    onPrices({
      last: Number.isFinite(last) && last > 0 ? last : null,
      bid: Number.isFinite(bid) && bid > 0 ? bid : null,
      ask: Number.isFinite(ask) && ask > 0 ? ask : null,
    });
  }, [ticker?.last_price, orderbook?.bids, orderbook?.asks, onPrices]);

  return null;
}

export function SpotTradingGrid() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get('symbol')?.toUpperCase().replace(/-/g, '_') ?? '';
  const { accessToken, user } = useAuthStore();
  const { authResolved, isAuthenticated } = useAuth();
  const { resolvedTheme } = useThemeStore();
  const isAuth = authResolved && isAuthenticated;
  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const tc = useTranslations('crypto');
  const { fromApi, networkUnreachable } = useApiErrorMessage();
  const [chartIntervalSeconds, setChartIntervalSeconds] = useState(() => {
    if (typeof window === 'undefined') return 60;
    const raw = Number(window.localStorage.getItem(CHART_INTERVAL_LS_KEY));
    return SUPPORTED_CHART_INTERVALS.has(raw) ? raw : 60;
  });
  const [chartViewMode, setChartViewMode] = useState<'chart' | 'depth'>(() => {
    if (typeof window === 'undefined') return 'chart';
    return window.localStorage.getItem(CHART_VIEW_MODE_LS_KEY) === 'depth' ? 'depth' : 'chart';
  });

  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<SpotGridOrderType>('limit');
  const [timeInForce, setTimeInForce] = useState<'gtc' | 'ioc' | 'fok'>('gtc');
  const [postOnly, setPostOnly] = useState(false);
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailingDelta, setTrailingDelta] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [tradesVersion, setTradesVersion] = useState(0);
  const [tradePreferences, setTradePreferences] = useState<TradePreferences>({
    promptConfirmationOrders: true,
    promptCancelAllConfirmation: true,
  });
  const [preferencesSyncIssue, setPreferencesSyncIssue] = useState(false);
  const [marketPrices, setMarketPrices] = useState<MarketPriceSnapshot>({ last: null, bid: null, ask: null });
  const clientOrderIdRef = useRef(generateClientOrderId());
  const handleMarketPrices = useCallback((p: MarketPriceSnapshot) => setMarketPrices(p), []);

  const { data: balancesByAccount = [], refetch: refetchBalances } = useBalancesByAccount(isAuth);
  const { sortWithFavoritesFirst, isFavorite, toggle: toggleFavorite } = useSpotFavorites();
  const balanceMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const row of balancesByAccount) {
      m[row.symbol] = row.trading ?? '0';
    }
    return m;
  }, [balancesByAccount]);

  const sortedMarkets = useMemo(() => sortWithFavoritesFirst(markets), [markets, sortWithFavoritesFirst]);
  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol), [markets, symbol]);
  const baseAsset = selectedMarket?.base_asset ?? '';
  const quoteAsset = selectedMarket?.quote_asset ?? '';

  const setSymbolAndUrl = useCallback(
    (s: string) => {
      setSymbol(s);
      router.replace(`${SPOT_TRADE_HREF}?symbol=${encodeURIComponent(s)}`, { scroll: false });
    },
    [router]
  );

  const handleSideChange = useCallback((s: 'buy' | 'sell') => {
    setSide(s);
  }, []);

  useEffect(() => {
    if (orderType !== 'limit') setPostOnly(false);
  }, [orderType]);

  useEffect(() => {
    if (postOnly && timeInForce !== 'gtc') setTimeInForce('gtc');
  }, [postOnly, timeInForce]);

  const availableBalance = useMemo(() => {
    if (side === 'buy') return balanceMap[quoteAsset] ?? '0';
    return balanceMap[baseAsset] ?? '0';
  }, [side, baseAsset, quoteAsset, balanceMap]);

  const quoteBalance = useMemo(() => balanceMap[quoteAsset] ?? '0', [quoteAsset, balanceMap]);
  const baseBalance = useMemo(() => balanceMap[baseAsset] ?? '0', [baseAsset, balanceMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHART_INTERVAL_LS_KEY, String(chartIntervalSeconds));
  }, [chartIntervalSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHART_VIEW_MODE_LS_KEY, chartViewMode);
  }, [chartViewMode]);

  useEffect(() => {
    if (!isAuth) {
      setTradePreferences({
        promptConfirmationOrders: true,
        promptCancelAllConfirmation: true,
      });
      return;
    }
    const ac = new AbortController();
    void api
      .get<Partial<TradePreferences>>('/api/v1/auth/preferences', { signal: ac.signal, notifyOnError: false })
      .then((res) => {
        if (!res.success || !res.data) return;
        setPreferencesSyncIssue(false);
        setTradePreferences((prev) => ({
          promptConfirmationOrders:
            typeof res.data?.promptConfirmationOrders === 'boolean'
              ? res.data.promptConfirmationOrders
              : prev.promptConfirmationOrders,
          promptCancelAllConfirmation:
            typeof res.data?.promptCancelAllConfirmation === 'boolean'
              ? res.data.promptCancelAllConfirmation
              : prev.promptCancelAllConfirmation,
        }));
      })
      .catch(() => {
        setPreferencesSyncIssue(true);
      });
    return () => ac.abort();
  }, [isAuth]);

  const validateOrderInput = useCallback(
    (candidateSide: 'buy' | 'sell', candidateQty: string): string | null => {
      const qty = toPositiveNumber(candidateQty.trim());
      if (!qty) return tc('validation.qtyRequired');

      if (orderType === 'limit' || orderType === 'stop_limit') {
        if (!toPositiveNumber(price.trim())) return tc('validation.limitPriceRequired');
      }
      if (orderType === 'stop_loss' || orderType === 'stop_limit') {
        if (!toPositiveNumber(stopPrice.trim())) return tc('validation.triggerPriceRequired');
      }
      if (orderType === 'trailing_stop_market') {
        const delta = toPositiveNumber(trailingDelta.trim());
        if (!delta || delta > 100) return tc('validation.trailingDeltaRange');
      }

      const minQty = selectedMarket?.min_qty ? Number(selectedMarket.min_qty) : NaN;
      if (Number.isFinite(minQty) && minQty > 0 && qty < minQty) {
        return tc('validation.minQty', { qty: selectedMarket?.min_qty ?? '', asset: baseAsset });
      }

      const limitPrice = toPositiveNumber(price.trim());
      const marketLast = selectedMarket?.last_price ? Number(selectedMarket.last_price) : NaN;
      const liveLast = marketPrices.last;
      const liveBid = marketPrices.bid;
      const liveAsk = marketPrices.ask;
      let referencePrice: number | null = null;

      if (orderType === 'limit' || orderType === 'stop_limit') {
        referencePrice = limitPrice;
      } else if (orderType === 'market') {
        const sideRef =
          candidateSide === 'buy'
            ? liveAsk ?? liveLast ?? (Number.isFinite(marketLast) ? marketLast : null)
            : liveBid ?? liveLast ?? (Number.isFinite(marketLast) ? marketLast : null);
        referencePrice = sideRef != null && sideRef > 0 ? sideRef : null;
        if (referencePrice == null) {
          return tc('validation.livePriceUnavailable');
        }
      } else {
        const fallback =
          liveLast ??
          (Number.isFinite(liveBid) && Number.isFinite(liveAsk) ? (liveBid! + liveAsk!) / 2 : null) ??
          (Number.isFinite(marketLast) && marketLast > 0 ? marketLast : null);
        referencePrice = fallback != null && fallback > 0 ? fallback : limitPrice;
      }

      const minNotional = selectedMarket?.min_notional ? Number(selectedMarket.min_notional) : NaN;
      if (
        Number.isFinite(minNotional) &&
        minNotional > 0 &&
        referencePrice != null &&
        referencePrice > 0 &&
        qty * referencePrice < minNotional
      ) {
        return tc('validation.minNotional', {
          min: selectedMarket?.min_notional ?? '',
          quote: quoteAsset,
          est: (qty * referencePrice).toFixed(2),
        });
      }

      if (candidateSide === 'buy' && Number(quoteBalance || '0') <= 0) {
        return tc('validation.insufficientQuoteBuy', { asset: quoteAsset });
      }
      if (candidateSide === 'sell' && qty > Number(baseBalance || '0')) {
        return tc('validation.insufficientBaseSell', { asset: baseAsset });
      }
      return null;
    },
    [
      orderType,
      price,
      stopPrice,
      trailingDelta,
      selectedMarket?.min_qty,
      selectedMarket?.min_notional,
      baseAsset,
      quoteAsset,
      quoteBalance,
      baseBalance,
      marketPrices.last,
      marketPrices.bid,
      marketPrices.ask,
      selectedMarket?.last_price,
      tc,
    ]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const panel = document.getElementById('spot-order-entry-panel');

      if (e.key === 'Enter') {
        if (!panel?.contains(target)) return;
        if (target.closest('[role="dialog"]')) return;
        if (target.tagName === 'TEXTAREA' && e.shiftKey) return;
        const btn = panel.querySelector<HTMLButtonElement>(`[data-spot-place-order][data-spot-side="${side}"]`);
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const key = e.key?.toLowerCase();
      if (key === 'b') {
        setSide('buy');
        e.preventDefault();
        requestAnimationFrame(() => document.getElementById('spot-price')?.focus());
      } else if (key === 's') {
        setSide('sell');
        e.preventDefault();
        requestAnimationFrame(() => document.getElementById('spot-price')?.focus());
      } else if (key === 'p') {
        document.getElementById('spot-price')?.focus();
        e.preventDefault();
      } else if (key === 'q') {
        document.getElementById('spot-quantity')?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [side]);

  const handlePriceClick = useCallback((p: string, q: string) => {
    setPrice(p);
    setQuantity((prev) => {
      if (q && !prev.trim()) return q;
      return prev;
    });
  }, []);

  const handleSubmit = useCallback(async (overrideSide?: 'buy' | 'sell', overrideQty?: string): Promise<void> => {
    const effectiveSide = overrideSide ?? side;
    const effectiveQty = (overrideQty ?? quantity).trim();
    if (!isAuth || !symbol || submitting) {
      throw new Error('Cannot submit order');
    }
    const validationError = validateOrderInput(effectiveSide, effectiveQty);
    if (validationError) {
      setSubmitError(validationError);
      toast({ title: tc('toasts.orderNotPlaced'), description: validationError, variant: 'destructive' });
      throw new Error(validationError);
    }
    setSubmitError(null);
    setSubmitting(true);
    if (overrideSide) setSide(overrideSide);
    if (overrideQty) setQuantity(overrideQty);
    const qtySnap = effectiveQty;
    try {
      const cid = generateClientOrderId();
      clientOrderIdRef.current = cid;
      const body: Record<string, string | boolean> = {
        market: symbol,
        side: effectiveSide,
        type: orderType,
        quantity: qtySnap,
        client_order_id: cid,
      };
      if ((orderType === 'limit' || orderType === 'stop_limit') && price.trim()) body.price = price.trim();
      if ((orderType === 'stop_loss' || orderType === 'stop_limit') && stopPrice.trim()) body.stop_price = stopPrice.trim();
      if (orderType === 'trailing_stop_market' && trailingDelta.trim()) body.trailing_delta = trailingDelta.trim();
      if (orderType === 'limit' || orderType === 'stop_limit') body.time_in_force = timeInForce;
      if (orderType === 'market' || orderType === 'trailing_stop_market') body.time_in_force = 'ioc';
      if (orderType === 'limit' && postOnly) body.post_only = true;

      const res = await api.post<{
        id?: string;
        status?: string;
        displayStatus?: string;
        filled_quantity?: string;
      }>('/api/v1/spot/order', body);
      if (res.success) {
        const base = baseAsset;
        const sd = effectiveSide;
        const ot = orderType;
        const d = res.data;
        const st = String(d?.status ?? '').toUpperCase();
        const label = typeof d?.displayStatus === 'string' ? d.displayStatus : st || 'Accepted';
        setQuantity('');
        setPrice('');
        setStopPrice('');
        setTrailingDelta('');
        setOrdersVersion((v) => v + 1);
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        refetchBalances();
        const sideLabel = sd === 'buy' ? tc('toasts.sideBuy') : tc('toasts.sideSell');
        const baseDesc = `${sideLabel} ${qtySnap} ${base} · ${spotOrderTypePlacementLabel(tc, ot)}`;
        if (st === 'FILLED') {
          toast({
            title: tc('toasts.filled'),
            description: tc('toasts.filledFullDesc', { desc: baseDesc }),
            variant: 'success',
          });
        } else if (st === 'PARTIALLY_FILLED') {
          const fq = d?.filled_quantity?.trim();
          toast({
            title: tc('toasts.partiallyFilled'),
            description: fq
              ? tc('toasts.partiallyFilledDesc', { desc: baseDesc, filled: fq })
              : tc('toasts.partiallyFilledGeneric', { desc: baseDesc }),
            variant: 'default',
          });
        } else if (st === 'REJECTED') {
          toast({
            title: tc('toasts.orderRejected'),
            description: tc('toasts.orderRejectedDesc', { desc: baseDesc }),
            variant: 'destructive',
          });
        } else {
          toast({
            title: tc('toasts.orderAccepted'),
            description: tc('toasts.orderAcceptedDesc', { desc: baseDesc, status: label }),
            variant: 'success',
          });
        }
      } else {
        const code = res.error?.code ? ` (${res.error.code})` : '';
        const msg = fromApi(res, 'generic.unknown');
        const detail = `${msg}${code}`;
        setSubmitError(detail);
        toast({
          title: tc('toasts.orderNotPlaced'),
          description: detail,
          variant: 'destructive',
        });
        const rej = new Error(detail) as Error & { spotApiRejected?: true };
        rej.spotApiRejected = true;
        throw rej;
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'spotApiRejected' in e) {
        throw e;
      }
      if (e instanceof Error && e.message === 'Cannot submit order') {
        throw e;
      }
      const msg = e instanceof Error ? e.message : networkUnreachable();
      setSubmitError(msg);
      toast({ title: tc('toasts.orderNotPlaced'), description: msg, variant: 'destructive' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [
    isAuth,
    symbol,
    side,
    orderType,
    timeInForce,
    postOnly,
    price,
    stopPrice,
    trailingDelta,
    quantity,
    submitting,
    baseAsset,
    validateOrderInput,
    queryClient,
    refetchBalances,
    tc,
    fromApi,
    networkUnreachable,
  ]);

  const onOrderStreamStatus = useCallback(
    (data: OrderUpdateMessage) => {
      const st = (data.status || '').toUpperCase();
      const mkt = data.market ? `${data.market} — ` : '';
      const disp = data.displayStatus ? String(data.displayStatus) : st;
      if (st === 'PENDING_TRIGGER') {
        toast({
          title: tc('toasts.pendingTrigger'),
          description: tc('toasts.pendingTriggerDesc', { market: mkt }),
          variant: 'default',
        });
        return;
      }
      if (st === 'FILLED') {
        toast({
          title: tc('toasts.filled'),
          description: data.market
            ? tc('toasts.filledWsDesc', { market: `${data.market} — ` })
            : tc('toasts.filledWsGeneric'),
          variant: 'success',
        });
        return;
      }
      if (st === 'PARTIALLY_FILLED') {
        const fq = data.filled_quantity?.trim();
        const q = data.quantity?.trim();
        const detail =
          fq && q
            ? tc('toasts.partialFillDetail', { filled: fq, total: q })
            : disp || tc('toasts.partialFillGeneric');
        toast({
          title: tc('toasts.partialFill'),
          description: detail,
          variant: 'default',
        });
        return;
      }
      if (st === 'CANCELLED') {
        toast({
          title: tc('toasts.cancelled'),
          description: tc('toasts.cancelledDesc', { market: mkt }),
          variant: 'default',
        });
        return;
      }
      if (st === 'REJECTED') {
        toast({
          title: tc('toasts.rejected'),
          description: tc('toasts.rejectedDesc', {
            market: mkt,
            detail: disp || tc('toasts.rejectedGeneric'),
          }),
          variant: 'destructive',
        });
      }
    },
    [tc]
  );

  const fetchMarkets = useCallback(
    async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
      setMarketsError(null);
      if (!opts?.silent) setMarketsLoading(true);
      try {
        const res = await api.get<Market[]>('/api/v1/spot/markets', {
          signal,
          notifyOnError: false,
          skipAuth: true,
        });
        if (signal?.aborted) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setMarkets(res.data);
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(
                SPOT_MARKETS_CACHE_KEY,
                JSON.stringify({ updatedAtMs: Date.now(), data: res.data })
              );
            } catch {
              // ignore storage quota/private mode errors
            }
          }
          const preferred = res.data.find((m) => m.symbol === 'BTC_USDT');
          const sym =
            symbolParam && res.data.some((m) => m.symbol === symbolParam)
              ? symbolParam
              : (preferred?.symbol ?? res.data[0]!.symbol);
          setSymbol(sym);
        } else {
          setMarkets([]);
          setMarketsError(res.success ? tc('markets.noneAvailable') : (res.error?.message ?? tc('markets.loadFailed')));
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setMarkets([]);
        setMarketsError(tc('markets.loadFailedRetry'));
      } finally {
        if (!signal?.aborted) setMarketsLoading(false);
      }
    },
    [symbolParam, tc]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(SPOT_MARKETS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { updatedAtMs?: number; data?: Market[] };
          const cached = Array.isArray(parsed?.data) ? parsed.data : [];
          const fresh = Number.isFinite(parsed?.updatedAtMs) && Date.now() - Number(parsed.updatedAtMs) <= SPOT_MARKETS_CACHE_TTL_MS;
          if (fresh && cached.length > 0) {
            setMarkets(cached);
            const preferred = cached.find((m) => m.symbol === 'BTC_USDT');
            const sym =
              symbolParam && cached.some((m) => m.symbol === symbolParam)
                ? symbolParam
                : (preferred?.symbol ?? cached[0]!.symbol);
            setSymbol(sym);
            setMarketsLoading(false);
          }
        }
      } catch {
        // Ignore malformed cached payloads.
      }
    }

    const ac = new AbortController();
    const fallback = setTimeout(() => {
      ac.abort();
      setMarketsLoading(false);
      setMarketsError(tc('markets.timeout'));
    }, 45000);

    fetchMarkets(ac.signal, { silent: markets.length > 0 }).finally(() => clearTimeout(fallback));

    return () => {
      ac.abort();
      clearTimeout(fallback);
    };
  }, [symbolParam, fetchMarkets, markets.length, tc]);

  if (marketsLoading && markets.length === 0 && !marketsError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-muted px-4 dark:bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Loading spot markets…</p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-muted px-4 dark:bg-background">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm dark:border-border dark:bg-card">
          <p className="text-sm font-semibold text-foreground">
            {marketsError || tc('markets.noSpotMarkets')}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Start the backend, ensure Postgres is up, and run migrations/seed if{' '}
            <code className="rounded bg-accent px-1 dark:bg-accent">spot_markets</code> is empty.
          </p>
          {typeof window !== 'undefined' && (
            <p className="mt-1 terminal-text-label text-muted-foreground">
              API base: <span className="font-mono">{getApiBaseUrl() || '(same origin)'}</span>
              {' · '}
              Override with <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span>
            </p>
          )}
          {(marketsError || marketsLoading) && (
            <button
              type="button"
              onClick={() => fetchMarkets(undefined, { silent: false })}
              disabled={marketsLoading}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary/85 disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (markets.length > 0 && !symbol) {
    return (
      <div
        className="flex h-full w-full flex-col bg-background"
        role="status"
        aria-busy="true"
        aria-label="Preparing trading terminal"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 dark:border-border">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 max-w-sm flex-1" />
        </div>
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <Skeleton className="hidden w-40 shrink-0 rounded-lg sm:block" />
          <Skeleton className="min-h-0 flex-1 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <SpotMarketDataProvider
      symbol={symbol}
      isAuth={isAuth}
      onOrderActivity={() => setOrdersVersion((v) => v + 1)}
      onUserTradeActivity={() => setTradesVersion((v) => v + 1)}
      onOrderStreamStatus={onOrderStreamStatus}
    >
      <SpotMarketPriceBridge onPrices={handleMarketPrices} />
      <SpotTradingGridTerminal
        markets={markets}
        sortedMarkets={sortedMarkets}
        symbol={symbol}
        setSymbolAndUrl={setSymbolAndUrl}
        isAuth={isAuth}
        userTierLevel={user?.tierLevel}
        chartTheme={chartTheme}
        chartIntervalSeconds={chartIntervalSeconds}
        setChartIntervalSeconds={(next) => {
          if (!SUPPORTED_CHART_INTERVALS.has(next)) return;
          setChartIntervalSeconds(next);
        }}
        chartViewMode={chartViewMode}
        setChartViewMode={setChartViewMode}
        isFavorite={isFavorite}
        toggleFavorite={toggleFavorite}
        side={side}
        orderType={orderType}
        timeInForce={timeInForce}
        postOnly={postOnly}
        price={price}
        stopPrice={stopPrice}
        trailingDelta={trailingDelta}
        submitting={submitting}
        submitError={submitError}
        setSubmitError={setSubmitError}
        ordersVersion={ordersVersion}
        tradesVersion={tradesVersion}
        handleSideChange={handleSideChange}
        setOrderType={setOrderType}
        setPrice={setPrice}
        setStopPrice={setStopPrice}
        setTrailingDelta={setTrailingDelta}
        setQuantity={setQuantity}
        setTimeInForce={setTimeInForce}
        setPostOnly={setPostOnly}
        handleSubmit={handleSubmit}
        handlePriceClick={handlePriceClick}
        availableBalance={availableBalance}
        quoteBalance={quoteBalance}
        baseBalance={baseBalance}
        requireOrderConfirmation={tradePreferences.promptConfirmationOrders}
        requireCancelAllConfirmation={tradePreferences.promptCancelAllConfirmation}
        preferencesSyncIssue={preferencesSyncIssue}
      />
    </SpotMarketDataProvider>
  );
}
