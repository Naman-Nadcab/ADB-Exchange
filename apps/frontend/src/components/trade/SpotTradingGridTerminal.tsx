'use client';

import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Info, TrendingUp } from 'lucide-react';
import { CoinIcon } from '@/components/ui/CoinIcon';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SPOT_TRADE_HREF, loginWithRedirect } from '@/lib/routes';
import { useTranslations } from 'next-intl';
import { ExchangeHeader } from '@/components/layout/ExchangeHeader';
import { PairHeader } from './PairHeader';
import { ChartPanel } from './ChartPanel';
import { ChartErrorBoundary } from './chart/ChartErrorBoundary';
import { SpotOrderbookPanel } from './SpotOrderbookPanel';
import { SpotBottomPanel } from './SpotBottomPanel';
import { TerminalEmptyState, TerminalLoadingRows } from './TerminalEmptyState';
import { formatMoverChangePct, moverChangeTone } from './terminalUiFormat';
import { SpotTerminalStatusRow } from './SpotTerminalStatusRow';
import { TerminalStatusChip } from './TerminalStatusChip';
import { MarketsSidebar, type MarketRow } from '@/components/trading/MarketsSidebar';
import { formatFixedTrim, formatValueFixedTrim } from './terminalFormat';
import {
  useSpotMarketOrderbook,
  useSpotMarketTicker,
  useSpotMarketTrades,
  useSpotMarketStream,
} from './SpotMarketDataContext';
import {
  filterTradesForDisplay,
  resolveSpotDisplayLastPrice,
  resolveStreamFreshnessSec,
} from '@/lib/spotPriceDisplay';

class PanelErrorBoundary extends Component<
  { children: ReactNode; name: string; errorMessage: string; retryLabel: string; resetKey?: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PanelErrorBoundary:${this.props.name}]`, error.message, info.componentStack);
  }
  componentDidUpdate(prevProps: { resetKey?: string }): void {
    if (prevProps.resetKey !== this.props.resetKey) this.setState({ hasError: false });
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[60px] flex-col items-center justify-center gap-2 bg-card px-3 py-4 text-center">
          <p className="text-label font-medium text-muted-foreground">{this.props.errorMessage}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded bg-muted px-3 py-1 text-label font-semibold text-foreground hover:bg-accent"
          >
            {this.props.retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function useDayChangePct24h(ticker: ReturnType<typeof useSpotMarketTicker>['ticker']) {
  return useMemo(() => {
    const last = ticker?.last_price != null && ticker.last_price !== '' ? Number(ticker.last_price) : NaN;
    const open = ticker?.open_24h != null && ticker.open_24h !== '' ? Number(ticker.open_24h) : NaN;
    if (Number.isFinite(last) && Number.isFinite(open) && open > 0) {
      return ((last - open) / open) * 100;
    }
    return null;
  }, [ticker?.last_price, ticker?.open_24h]);
}

const SPOT_CHART_SPLIT_STORAGE_KEY = 'spotTerminal.chartSplitChartGrowPct';
const SPOT_MOBILE_TAB_STORAGE_KEY = 'spotTerminal.mobileTab';

type SpotMobileTab = 'chart' | 'book' | 'trade' | 'markets';

const SPOT_MOBILE_TAB_IDS: SpotMobileTab[] = ['chart', 'book', 'trade', 'markets'];

function clampChartSplitPct(n: number): number {
  if (!Number.isFinite(n)) return 75;
  return Math.min(82, Math.max(38, n));
}

/** Vertical split between chart and order form; persisted in sessionStorage. */
function useChartOrderVerticalSplit() {
  const [chartGrowPct, setChartGrowPct] = useState(75);
  const chartGrowRef = useRef(75);
  const splitRootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPct: number; height: number } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SPOT_CHART_SPLIT_STORAGE_KEY);
      if (raw != null) {
        const pct = clampChartSplitPct(parseFloat(raw));
        setChartGrowPct(pct);
        chartGrowRef.current = pct;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    chartGrowRef.current = chartGrowPct;
  }, [chartGrowPct]);

  const onSplitPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = splitRootRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    dragRef.current = {
      startY: e.clientY,
      startPct: chartGrowRef.current,
      height: Math.max(h, 1),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onSplitPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const delta = (-dy / d.height) * 100;
    setChartGrowPct(clampChartSplitPct(d.startPct + delta));
  }, []);

  const onSplitPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current == null) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem(SPOT_CHART_SPLIT_STORAGE_KEY, String(chartGrowRef.current));
    } catch {
      /* ignore */
    }
  }, []);

  return {
    chartGrowPct,
    splitRootRef,
    splitBarProps: {
      onPointerDown: onSplitPointerDown,
      onPointerMove: onSplitPointerMove,
      onPointerUp: onSplitPointerUp,
      onPointerCancel: onSplitPointerUp,
    } as const,
  };
}

function SpotChartSection({
  symbol,
  baseAsset,
  quoteAsset,
  pricePrecision,
  chartIntervalSeconds,
  chartTheme,
  chartViewMode,
  onIntervalSecondsChange,
  onViewModeChange,
}: {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  chartIntervalSeconds: number;
  chartTheme: 'dark' | 'light';
  chartViewMode: 'chart' | 'depth';
  onIntervalSecondsChange: (v: number) => void;
  onViewModeChange: (m: 'chart' | 'depth') => void;
}) {
  const { ticker } = useSpotMarketTicker();
  const { recentTrades } = useSpotMarketTrades();
  const { orderbook } = useSpotMarketOrderbook();
  const { streamPhase, lastRttMs } = useSpotMarketStream();
  const dayChangePct24h = useDayChangePct24h(ticker);

  const displayLastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price,
    orderbook,
    recentTrades,
  });
  const displayTrades = useMemo(
    () => filterTradesForDisplay(recentTrades, displayLastPrice),
    [recentTrades, displayLastPrice]
  );
  const latestTradeAgeSec = useMemo(
    () =>
      resolveStreamFreshnessSec({
        recentTrades: displayTrades,
        streamPhase,
        tickerLast: ticker?.last_price,
      }),
    [displayTrades, streamPhase, ticker?.last_price]
  );

  return (
    <ChartErrorBoundary resetKey={`${symbol}-${chartIntervalSeconds}-${chartViewMode}`}>
      <ChartPanel
        symbol={symbol}
        baseAsset={baseAsset}
        quoteAsset={quoteAsset}
        pricePrecision={pricePrecision}
        intervalSeconds={chartIntervalSeconds}
        theme={chartTheme}
        lastPrice={displayLastPrice}
        bid={ticker?.bid ?? orderbook?.bids?.[0]?.price ?? null}
        ask={ticker?.ask ?? orderbook?.asks?.[0]?.price ?? null}
        high24h={ticker?.high_24h ?? null}
        low24h={ticker?.low_24h ?? null}
        volume24h={ticker?.base_volume_24h ?? null}
        turnoverQuote24h={ticker?.volume_24h ?? null}
        dayChangePct24h={dayChangePct24h}
        onIntervalSecondsChange={onIntervalSecondsChange}
        livePrice={displayLastPrice}
        liveTrades={displayTrades}
        viewMode={chartViewMode}
        onViewModeChange={onViewModeChange}
        depthBids={orderbook?.bids ?? []}
        depthAsks={orderbook?.asks ?? []}
        hideDuplicatePairSummary
        wsStreamPhase={streamPhase}
        wsLastRttMs={lastRttMs}
        tradeFreshnessSec={latestTradeAgeSec}
      />
    </ChartErrorBoundary>
  );
}

function SpotPairHeaderSection({
  embedded,
  symbol,
  baseAsset,
  quoteAsset,
  pricePrecision,
  sortedMarkets,
  onSymbolChange,
  isFavorite,
  onToggleFavorite,
  tierLevel,
  marketStatus,
}: {
  embedded?: boolean;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  sortedMarkets: Market[];
  onSymbolChange: (s: string) => void;
  isFavorite: (s: string) => boolean;
  onToggleFavorite: (s: string) => void;
  tierLevel?: number;
  marketStatus?: string | null;
}) {
  const { ticker } = useSpotMarketTicker();
  const { orderbook } = useSpotMarketOrderbook();
  const { recentTrades } = useSpotMarketTrades();
  const { streamPhase, lastRttMs } = useSpotMarketStream();
  const dayChangePct24h = useDayChangePct24h(ticker);

  const lastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price,
    orderbook,
    recentTrades,
  });

  return (
    <PairHeader
      embedded={embedded}
      symbol={symbol}
      baseAsset={baseAsset}
      quoteAsset={quoteAsset}
      lastPrice={lastPrice}
      bid={orderbook?.bids?.[0]?.price ?? ticker?.bid ?? null}
      ask={orderbook?.asks?.[0]?.price ?? ticker?.ask ?? null}
      pricePrecision={pricePrecision}
      changePct24h={dayChangePct24h}
      high24h={ticker?.high_24h ?? null}
      low24h={ticker?.low_24h ?? null}
      volume24h={ticker?.base_volume_24h ?? null}
      turnover24h={ticker?.volume_24h ?? null}
      markets={sortedMarkets}
      onSymbolChange={onSymbolChange}
      wsStreamPhase={streamPhase}
      wsLastRttMs={lastRttMs}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      tierLevel={tierLevel}
      marketStatus={marketStatus}
    />
  );
}

const SpotOrderbookSection = memo(function SpotOrderbookSection({
  quoteAsset,
  baseAsset,
  pricePrecision,
  qtyPrecision,
  onPriceClick,
}: {
  quoteAsset: string;
  baseAsset: string;
  pricePrecision: number;
  qtyPrecision: number;
  onPriceClick: (p: string, q: string) => void;
}) {
  const { orderbook, orderbookLoading } = useSpotMarketOrderbook();
  const { ticker } = useSpotMarketTicker();
  const { recentTrades } = useSpotMarketTrades();

  const displayLastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price,
    orderbook,
    recentTrades,
  });
  const displayTrades = useMemo(
    () => filterTradesForDisplay(recentTrades, displayLastPrice),
    [recentTrades, displayLastPrice]
  );

  return (
    <SpotOrderbookPanel
      bids={orderbook?.bids ?? []}
      asks={orderbook?.asks ?? []}
      quoteAsset={quoteAsset}
      baseAsset={baseAsset}
      onPriceClick={onPriceClick}
      onTradePriceClick={onPriceClick}
      loading={orderbookLoading}
      recentTrades={displayTrades}
      lastPrice={displayLastPrice}
      pricePrecision={pricePrecision}
      qtyPrecision={qtyPrecision}
    />
  );
});

const RecentTradesPanel = memo(function RecentTradesPanel({
  baseAsset,
  quoteAsset,
  pricePrecision,
  qtyPrecision,
}: {
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  qtyPrecision: number;
}) {
  const { recentTrades } = useSpotMarketTrades();
  const { ticker } = useSpotMarketTicker();
  const { orderbook } = useSpotMarketOrderbook();
  const { streamPhase } = useSpotMarketStream();

  const displayLastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price,
    orderbook,
    recentTrades,
  });
  const trades = useMemo(
    () => filterTradesForDisplay(recentTrades ?? [], displayLastPrice),
    [recentTrades, displayLastPrice]
  );
  const topTrades = trades.slice(0, 30);
  const isInitialLoading = topTrades.length === 0 && streamPhase !== 'live';
  const t = useTranslations('crypto');

  return (
    <div className="exchange-ui flex h-full min-h-0 flex-col overflow-hidden antialiased">
      <div className="flex shrink-0 items-center border-b border-border px-2 py-1">
        <span className="terminal-text-label font-semibold leading-none tracking-tight text-foreground">
          {t('terminal.marketTrades')}
        </span>
      </div>
      <div className="flex shrink-0 items-center border-b border-border px-2 py-1 terminal-text-label font-semibold uppercase leading-none text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" title={t('terminal.priceColumn', { asset: quoteAsset })}>
          {t('trading.price')}
        </span>
        <span className="min-w-0 flex-1 truncate text-right" title={t('terminal.amountColumn', { asset: baseAsset })}>
          {t('terminal.qty')}
        </span>
        <span className="w-[52px] shrink-0 truncate text-right" title={t('terminal.time')}>
          {t('terminal.time')}
        </span>
      </div>
      <div className="spot-rail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-0.5" tabIndex={0}>
        {isInitialLoading ? (
          <TerminalLoadingRows rows={12} />
        ) : topTrades.length === 0 ? (
          <TerminalEmptyState
            kind="trades"
            title={t('empty.waitingMarketActivity')}
            description={t('empty.waitingMarketActivityDesc')}
            compact
          />
        ) : (
          topTrades.map((t, i) => {
            const isBuy = t.side === 'buy';
            const time = t.time
              ? new Date(t.time).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '';
            return (
              <div
                key={`${t.id || t.time || 'trade'}-${i}`}
                className="orderbook-row flex shrink-0 items-center px-2 py-1 terminal-text-table numeric leading-none"
              >
                <span className={`min-w-0 flex-1 truncate font-semibold ${isBuy ? 'text-buy' : 'text-sell'}`}>
                  {formatValueFixedTrim(t.price, pricePrecision)}
                </span>
                <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground/90">
                  {formatValueFixedTrim(t.quantity, qtyPrecision)}
                </span>
                <span className="w-[52px] shrink-0 text-right font-medium text-muted-foreground">{time}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

function RightMarketListSection({
  sortedMarkets,
  symbol,
  onSymbolChange,
  isFavorite,
  onToggleFavorite,
}: {
  sortedMarkets: Market[];
  symbol: string;
  onSymbolChange: (s: string) => void;
  isFavorite: (s: string) => boolean;
  onToggleFavorite: (s: string) => void;
}) {
  const { ticker } = useSpotMarketTicker();

  const enrichedMarkets: MarketRow[] = useMemo(() => {
    return sortedMarkets.map((m) => {
      const isSelected = m.symbol === symbol;
      const price = isSelected && ticker?.last_price ? ticker.last_price : m.last_price ?? null;
      const open = isSelected && ticker?.open_24h ? ticker.open_24h : m.open_24h ?? null;
      const vol = isSelected && ticker?.base_volume_24h ? ticker.base_volume_24h : m.volume_24h ?? null;
      const pNum = price ? parseFloat(price) : NaN;
      const oNum = open ? parseFloat(open) : NaN;
      const change = Number.isFinite(pNum) && Number.isFinite(oNum) && oNum > 0 ? ((pNum - oNum) / oNum) * 100 : (m.change_pct ?? null);
      return {
        symbol: m.symbol,
        base_asset: m.base_asset,
        quote_asset: m.quote_asset,
        last_price: price,
        change_24h: change,
        volume_24h: vol,
        price_precision: m.price_precision,
      };
    });
  }, [sortedMarkets, symbol, ticker]);

  const favSymbols = useMemo(
    () => sortedMarkets.filter((m) => isFavorite(m.symbol)).map((m) => m.symbol),
    [sortedMarkets, isFavorite]
  );

  return (
    <MarketsSidebar
      variant="terminal"
      markets={enrichedMarkets}
      selectedSymbol={symbol}
      onSelectSymbol={onSymbolChange}
      favorites={favSymbols}
      onToggleFavorite={onToggleFavorite}
    />
  );
}

function TopMoversSection({
  sortedMarkets,
  symbol,
  onSymbolChange,
  expanded,
  onToggleExpand,
}: {
  sortedMarkets: Market[];
  symbol: string;
  onSymbolChange: (s: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const t = useTranslations('crypto');
  const { ticker } = useSpotMarketTicker();

  const movers = useMemo(() => {
    const enriched = sortedMarkets.map((m) => {
      const isSelected = m.symbol === symbol;
      const price = isSelected && ticker?.last_price ? ticker.last_price : m.last_price ?? null;
      const open = isSelected && ticker?.open_24h ? ticker.open_24h : m.open_24h ?? null;
      const pNum = price ? parseFloat(price) : NaN;
      const oNum = open ? parseFloat(open) : NaN;
      const change = Number.isFinite(pNum) && Number.isFinite(oNum) && oNum > 0 ? ((pNum - oNum) / oNum) * 100 : (m.change_pct ?? null);
      return {
        symbol: m.symbol,
        base: m.base_asset,
        quote: m.quote_asset,
        change,
        price,
      };
    });
    return [...enriched]
      .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
      .slice(0, 12);
  }, [sortedMarkets, symbol, ticker]);

  const top = movers[0];

  const renderRow = (m: (typeof movers)[0], compact: boolean) => {
    const tone = moverChangeTone(m.change);
    const isActive = m.symbol === symbol;
    return (
      <button
        key={m.symbol}
        type="button"
        onClick={() => onSymbolChange(m.symbol)}
        className={`orderbook-row flex w-full items-center justify-between gap-2 px-2 text-left terminal-text-table leading-none transition-colors ${
          compact ? 'py-1' : 'py-1.5'
        } ${isActive ? 'bg-muted/50 shadow-[inset_2px_0_0_hsl(var(--primary))]' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <CoinIcon symbol={m.base} size={compact ? 13 : 14} />
          <span className="truncate font-semibold tracking-tight text-foreground">{m.base}</span>
          <span className="shrink-0 font-medium text-muted-foreground">/{m.quote}</span>
        </div>
        <span
          className={`shrink-0 numeric font-semibold ${
            tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-muted-foreground'
          }`}
        >
          {formatMoverChangePct(m.change)}
        </span>
      </button>
    );
  };

  return (
    <div className="exchange-ui flex h-full min-h-0 flex-col overflow-hidden antialiased">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        aria-controls="spot-top-movers-list"
        id="spot-top-movers-heading"
        className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1 text-left transition-colors duration-150 hover:bg-muted/35"
      >
        <span className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="terminal-text-label font-semibold uppercase tracking-wider text-muted-foreground">{t('terminal.topMovers')}</span>
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {expanded ? (
        <div
          id="spot-top-movers-list"
          role="region"
          aria-labelledby="spot-top-movers-heading"
          className="spot-rail-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5"
          tabIndex={0}
        >
          {movers.length === 0 ? (
            <TerminalEmptyState
              kind="markets"
              title={t('terminal.topMoversEmptyTitle')}
              description={t('terminal.topMoversEmptyDesc')}
              compact
            />
          ) : (
            movers.map((m) => renderRow(m, false))
          )}
        </div>
      ) : (
        <div id="spot-top-movers-list" className="shrink-0" role="region" aria-labelledby="spot-top-movers-heading" tabIndex={0}>
          {top ? (
            renderRow(top, true)
          ) : (
            <TerminalEmptyState kind="markets" title={t('terminal.topMoversEmptyTitle')} compact />
          )}
        </div>
      )}
    </div>
  );
}

const SLIDER_PCTS = [0, 25, 50, 75, 100];

function BinanceInsetField({ label, suffix, children }: { label: string; suffix: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-muted/45 px-2 py-1.5 transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/35 hover:bg-muted/55 focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/20 dark:border-border dark:bg-card/85 dark:hover:bg-muted/45">
      <span className="shrink-0 terminal-text-label font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
      <span className="shrink-0 pl-0.5 terminal-text-label font-semibold text-muted-foreground">{suffix}</span>
    </div>
  );
}

function BinanceOrderEntrySection({
  orderType, setOrderType, timeInForce, setTimeInForce, postOnly, setPostOnly,
  price, setPrice, stopPrice, setStopPrice, trailingDelta, setTrailingDelta,
  baseAsset, quoteAsset, pricePrecision, qtyPrecision,
  isAuth, submitting, handleSubmit, handleSideChange, setQuantity, selectedMarket,
  availableBalance, quoteBalance, baseBalance, side,
  requireOrderConfirmation, tradingEnabled,
  marketStatus: _marketStatus,
}: {
  orderType: 'limit' | 'market' | 'stop_loss' | 'stop_limit' | 'trailing_stop_market';
  setOrderType: (t: 'limit' | 'market' | 'stop_loss' | 'stop_limit' | 'trailing_stop_market') => void;
  timeInForce: 'gtc' | 'ioc' | 'fok';
  setTimeInForce: (t: 'gtc' | 'ioc' | 'fok') => void;
  postOnly: boolean;
  setPostOnly: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  stopPrice: string;
  setStopPrice: (v: string) => void;
  trailingDelta: string;
  setTrailingDelta: (v: string) => void;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  qtyPrecision: number;
  isAuth: boolean;
  submitting: boolean;
  handleSubmit: (overrideSide?: 'buy' | 'sell', overrideQty?: string) => Promise<void>;
  handleSideChange: (s: 'buy' | 'sell') => void;
  setQuantity: (v: string) => void;
  selectedMarket: Market | undefined;
  availableBalance: string;
  quoteBalance: string;
  baseBalance: string;
  side: 'buy' | 'sell';
  requireOrderConfirmation: boolean;
  tradingEnabled: boolean;
  marketStatus?: string | null;
}) {
  const { orderbook } = useSpotMarketOrderbook();
  const { ticker } = useSpotMarketTicker();
  const { recentTrades } = useSpotMarketTrades();
  const [buyQty, setBuyQty] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [buySlider, setBuySlider] = useState(0);
  const [sellSlider, setSellSlider] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ side: 'buy' | 'sell'; qty: string } | null>(null);
  const t = useTranslations('crypto');
  const tCommon = useTranslations('common');
  const orderTypeLabels = useMemo(
    () => ({
      limit: t('trading.limit'),
      market: t('trading.market'),
      stop_limit: t('trading.stopLimit'),
      stop_loss: t('trading.stop'),
      trailing_stop_market: t('trading.trailing'),
    }),
    [t]
  );

  const lastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price,
    orderbook,
    recentTrades,
  });

  const parsedInputPrice = parseFloat(price);
  const liveRefPrice = lastPrice ? parseFloat(lastPrice) : 0;
  const bestBidRefPrice = parseFloat(orderbook?.bids?.[0]?.price ?? '');
  const bestAskRefPrice = parseFloat(orderbook?.asks?.[0]?.price ?? '');
  const marketBuyRefPrice = Number.isFinite(bestAskRefPrice) && bestAskRefPrice > 0 ? bestAskRefPrice : liveRefPrice;
  const marketSellRefPrice = Number.isFinite(bestBidRefPrice) && bestBidRefPrice > 0 ? bestBidRefPrice : liveRefPrice;
  const limitRefPrice =
    Number.isFinite(parsedInputPrice) && parsedInputPrice > 0 ? parsedInputPrice : liveRefPrice;
  const showPrice = orderType === 'limit' || orderType === 'stop_limit';
  const showStopPrice = orderType === 'stop_loss' || orderType === 'stop_limit';
  const showTrailing = orderType === 'trailing_stop_market';

  /** Quote-side display (balance, total, placeholder): max 0.01 step; submission still uses full `price` / qty strings. */
  const quoteFormDisplayDp = Math.min(2, Math.max(0, pricePrecision));
  const lastPxNum = lastPrice != null && String(lastPrice).trim() !== '' ? parseFloat(String(lastPrice)) : NaN;
  const pricePlaceholder = Number.isFinite(lastPxNum) ? formatFixedTrim(lastPxNum, quoteFormDisplayDp) : '';

  const buyQtyNum = parseFloat(buyQty) || 0;
  const sellQtyNum = parseFloat(sellQty) || 0;
  const buyEstPrice = orderType === 'limit' || orderType === 'stop_limit' ? limitRefPrice : marketBuyRefPrice;
  const sellEstPrice = orderType === 'limit' || orderType === 'stop_limit' ? limitRefPrice : marketSellRefPrice;
  const buyTotal =
    buyEstPrice > 0 && buyQtyNum > 0 ? formatFixedTrim(buyEstPrice * buyQtyNum, quoteFormDisplayDp) : '';
  const sellTotal =
    sellEstPrice > 0 && sellQtyNum > 0 ? formatFixedTrim(sellEstPrice * sellQtyNum, quoteFormDisplayDp) : '';

  const quoteBal = parseFloat(quoteBalance) || 0;
  const baseBal = parseFloat(baseBalance) || 0;

  const inputCls =
    'numeric min-w-0 flex-1 border-0 bg-transparent p-0 text-right terminal-text-primary font-semibold tabular-nums tracking-tight text-foreground outline-none focus:ring-0 placeholder:text-muted-foreground/50';
  const normalizeFeeRate = (raw?: string): number => {
    const n = Number(raw ?? '');
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n > 1 ? n / 100 : n;
  };
  const makerFeeRate = normalizeFeeRate(selectedMarket?.maker_fee);
  const takerFeeRate = normalizeFeeRate(selectedMarket?.taker_fee);
  const estimatedFeeRate = orderType === 'limit' && postOnly ? makerFeeRate : takerFeeRate;
  const buyNotional = buyEstPrice > 0 && buyQtyNum > 0 ? buyEstPrice * buyQtyNum : 0;
  const sellNotional = sellEstPrice > 0 && sellQtyNum > 0 ? sellEstPrice * sellQtyNum : 0;
  const buyFeeQuote = buyNotional > 0 ? buyNotional * estimatedFeeRate : 0;
  const sellFeeQuote = sellNotional > 0 ? sellNotional * estimatedFeeRate : 0;
  const buyNetBase = buyQtyNum > 0 ? buyQtyNum * Math.max(0, 1 - estimatedFeeRate) : 0;
  const sellNetQuote = sellNotional > 0 ? sellNotional - sellFeeQuote : 0;
  const executionMode = orderType === 'limit' && postOnly ? t('terminal.maker') : t('terminal.taker');
  const executionHint =
    orderType === 'market'
      ? t('executionHints.topOfBookEst')
      : orderType === 'limit'
        ? postOnly
          ? t('executionHints.postOnlyMaker')
          : t('executionHints.limitOnBook')
        : orderType === 'stop_limit'
          ? t('executionHints.triggeredLimit')
          : orderType === 'stop_loss'
            ? t('executionHints.triggeredMarket')
            : t('executionHints.trailingTrigger');

  const handleBuySlider = (pct: number) => {
    setBuySlider(pct);
    if (buyEstPrice > 0 && quoteBal > 0) {
      const factor = 10 ** qtyPrecision;
      const raw = (quoteBal * (pct / 100)) / buyEstPrice;
      setBuyQty(pct > 0 ? (Math.floor(raw * factor) / factor).toFixed(qtyPrecision) : '');
    }
  };

  const handleSellSlider = (pct: number) => {
    setSellSlider(pct);
    if (baseBal > 0) {
      const factor = 10 ** qtyPrecision;
      setSellQty(pct > 0 ? (Math.floor(baseBal * (pct / 100) * factor) / factor).toFixed(qtyPrecision) : '');
    }
  };

  const submitOrder = async (orderSide: 'buy' | 'sell', qty: string) => {
    if (!tradingEnabled) return;
    handleSideChange(orderSide);
    setQuantity(qty);
    try {
      await handleSubmit(orderSide, qty);
      if (orderSide === 'buy') {
        setBuyQty('');
        setBuySlider(0);
      } else {
        setSellQty('');
        setSellSlider(0);
      }
    } catch {
      /* error toasts handled upstream */
    } finally {
      setPendingOrder(null);
      setConfirmOpen(false);
    }
  };

  const doBuy = async () => {
    if (!buyQty.trim()) return;
    if (requireOrderConfirmation) {
      setPendingOrder({ side: 'buy', qty: buyQty.trim() });
      setConfirmOpen(true);
      return;
    }
    await submitOrder('buy', buyQty.trim());
  };

  const doSell = async () => {
    if (!sellQty.trim()) return;
    if (requireOrderConfirmation) {
      setPendingOrder({ side: 'sell', qty: sellQty.trim() });
      setConfirmOpen(true);
      return;
    }
    await submitOrder('sell', sellQty.trim());
  };

  const advancedTypes = ['stop_loss', 'stop_limit', 'trailing_stop_market'] as const;
  const showTifControls = orderType === 'limit' || orderType === 'stop_limit';
  const showPostOnly = orderType === 'limit';

  return (
    <div
      id="spot-order-entry-panel"
      className="exchange-ui flex h-full min-h-0 flex-col overflow-hidden antialiased text-foreground"
    >
      {/* Product + order type + execution meta — compact single chrome stack */}
      <div className="flex h-8 shrink-0 items-end gap-0 border-b border-border px-2">
        <span className="mr-1.5 pb-2 terminal-text-label font-semibold uppercase leading-none tracking-wide text-muted-foreground">
          {t('terminal.orderEntry')}
        </span>
        <span className="mb-2 h-2.5 w-px shrink-0 bg-border" aria-hidden />
        <span className="mr-1.5 pb-2 text-label font-bold leading-none tracking-wide text-primary">{t('terminal.spot')}</span>
        <span className="mb-2 h-2.5 w-px shrink-0 bg-border" aria-hidden />
        {(['limit', 'market'] as const).map((typeKey) => (
          <button
            key={typeKey}
            type="button"
            onClick={() => setOrderType(typeKey)}
            className={`relative px-2 pb-2 pt-1 text-label font-semibold leading-none transition-colors ${
              orderType === typeKey
                ? 'text-foreground after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:rounded-sm after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {orderTypeLabels[typeKey]}
          </button>
        ))}
        {advancedTypes.map((tKey) => (
          <button
            key={tKey}
            type="button"
            onClick={() => setOrderType(tKey)}
            className={`relative px-1.5 pb-2 pt-1 text-label font-semibold leading-none transition-colors ${
              orderType === tKey
                ? 'text-foreground after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:rounded-sm after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {orderTypeLabels[tKey]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-muted/20 px-2 py-1">
        {showTifControls && (
          <>
            <span className="terminal-text-label font-semibold uppercase leading-none text-muted-foreground">{t('terminal.tif')}</span>
            {(['gtc', 'ioc', 'fok'] as const).map((tif) => (
              <button
                key={tif}
                type="button"
                onClick={() => setTimeInForce(tif)}
                className={`rounded px-2 py-0.5 terminal-text-label font-semibold uppercase leading-none transition-colors duration-150 ${
                  timeInForce === tif
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tif}
              </button>
            ))}
            {showPostOnly && (
              <label className="flex cursor-pointer items-center gap-1.5 terminal-text-label font-medium leading-none text-foreground">
                <input
                  type="checkbox"
                  checked={postOnly}
                  onChange={(e) => setPostOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                {t('terminal.postOnly')}
              </label>
            )}
            <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
          </>
        )}
        <TerminalStatusChip
          label={tradingEnabled ? t('terminal.ordersReady') : t('terminal.feedSyncing')}
          tone={tradingEnabled ? 'live' : 'sync'}
          pulse={!tradingEnabled}
          title={tradingEnabled ? t('terminal.ordersReadyTitle') : t('terminal.feedSyncingTitle')}
        />
        <span className={`terminal-text-meta leading-none text-muted-foreground ${showTifControls ? '' : 'ml-auto'}`}>
          {t('terminal.fee')}{' '}
          <span className="numeric font-medium text-foreground">{(estimatedFeeRate * 100).toFixed(3)}%</span>
        </span>
        <span className="terminal-text-meta leading-none text-muted-foreground">
          {t('terminal.mode')}{' '}
          <span className="numeric font-medium text-foreground">{executionMode}</span>
        </span>
      </div>

      {/* Side-by-side Buy / Sell */}
      <div className="spot-order-entry-scroll grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
        {/* BUY */}
        <div className="rounded-md border border-buy/35 bg-buy/[0.05] p-2 shadow-[inset_0_1px_0_hsl(var(--exchange-buy)/0.08)] transition-colors duration-150">
          <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="terminal-text-primary font-semibold tracking-tight text-foreground">
              {t('terminal.buyAsset', { asset: baseAsset })}
            </span>
            <span className="numeric terminal-text-secondary text-muted-foreground">
              {formatValueFixedTrim(quoteBalance, quoteFormDisplayDp)} {quoteAsset}
            </span>
          </div>
          {showPrice && (
            <BinanceInsetField label={t('terminal.dualPanel.price')} suffix={quoteAsset}>
              <input
                id="spot-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
                placeholder={pricePlaceholder || '0'}
              />
            </BinanceInsetField>
          )}
          {showStopPrice && <BinanceInsetField label={t('terminal.dualPanel.stop')} suffix={quoteAsset}><input type="text" inputMode="decimal" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className={inputCls} placeholder="0" /></BinanceInsetField>}
          {showTrailing && <BinanceInsetField label={t('terminal.dualPanel.delta')} suffix="%"><input type="text" inputMode="decimal" value={trailingDelta} onChange={(e) => setTrailingDelta(e.target.value)} className={inputCls} placeholder="1.0" /></BinanceInsetField>}
          <BinanceInsetField label={t('terminal.dualPanel.amt')} suffix={baseAsset}><input id="spot-quantity" type="text" inputMode="decimal" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} className={inputCls} placeholder="0" /></BinanceInsetField>
          <div className="flex items-center gap-2">
            {SLIDER_PCTS.filter(Boolean).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleBuySlider(p)}
                className={`flex-1 rounded py-1.5 text-center terminal-text-label font-medium leading-none transition-all duration-150 active:scale-[0.98] ${
                  buySlider >= p ? 'bg-buy/15 text-buy ring-1 ring-buy/25' : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <BinanceInsetField label={t('terminal.dualPanel.total')} suffix={quoteAsset}>
            <span className={`${inputCls} ${buyTotal ? 'text-foreground' : 'text-muted-foreground'}`}>{buyTotal || '—'}</span>
          </BinanceInsetField>
          <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 terminal-text-meta leading-snug">
            <span className="text-muted-foreground">{t('terminal.dualPanel.youPay')}</span>
            <span className="numeric text-right text-foreground">
              {buyNotional > 0 ? `${formatFixedTrim(buyNotional, quoteFormDisplayDp)} ${quoteAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.youReceive')}</span>
            <span className="numeric text-right text-foreground">
              {buyQtyNum > 0 ? `${formatFixedTrim(buyQtyNum, qtyPrecision)} ${baseAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.estimatedFee', { pct: (estimatedFeeRate * 100).toFixed(3) })}</span>
            <span className="numeric text-right text-foreground">
              {buyFeeQuote > 0 ? `${formatFixedTrim(buyFeeQuote, quoteFormDisplayDp)} ${quoteAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.netReceive')}</span>
            <span className="numeric text-right text-buy">
              {buyNetBase > 0 ? `${formatFixedTrim(buyNetBase, qtyPrecision)} ${baseAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.estimatedExecution')}</span>
            <span className="numeric text-right text-foreground">
              {`${executionMode} · ${executionHint}`}
            </span>
          </div>
          {!isAuth ? (
            <Link
              href={loginWithRedirect(SPOT_TRADE_HREF)}
              className="flex h-10 min-h-[40px] items-center justify-center rounded-lg border border-buy/30 bg-buy/90 text-price font-semibold tracking-wide text-neutral-950 shadow-sm transition-all hover:bg-buy active:scale-[0.99] active:brightness-95"
            >
              {t('terminal.logIn')}
            </Link>
          ) : (
            <button
              type="button"
              data-spot-place-order
              data-spot-side="buy"
              disabled={submitting || !buyQty.trim() || !tradingEnabled}
              onClick={doBuy}
              className="flex h-10 min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-buy/30 bg-buy/90 text-price font-semibold tracking-wide text-neutral-950 shadow-sm transition-all hover:bg-buy active:scale-[0.99] active:brightness-95 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting && side === 'buy' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('terminal.buyAsset', { asset: baseAsset })}
            </button>
          )}
          </div>
        </div>

        {/* SELL */}
        <div className="rounded-md border border-sell/35 bg-sell/[0.045] p-2 shadow-[inset_0_1px_0_hsl(var(--exchange-sell)/0.08)] transition-colors duration-150">
          <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="terminal-text-primary font-semibold tracking-tight text-foreground">
              {t('terminal.sellAsset', { asset: baseAsset })}
            </span>
            <span className="numeric terminal-text-secondary text-muted-foreground">
              {formatValueFixedTrim(baseBalance, qtyPrecision)} {baseAsset}
            </span>
          </div>
          {showPrice && (
            <BinanceInsetField label={t('terminal.dualPanel.price')} suffix={quoteAsset}>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
                placeholder={pricePlaceholder || '0'}
              />
            </BinanceInsetField>
          )}
          {showStopPrice && <BinanceInsetField label={t('terminal.dualPanel.stop')} suffix={quoteAsset}><input type="text" inputMode="decimal" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className={inputCls} placeholder="0" /></BinanceInsetField>}
          {showTrailing && <BinanceInsetField label={t('terminal.dualPanel.delta')} suffix="%"><input type="text" inputMode="decimal" value={trailingDelta} onChange={(e) => setTrailingDelta(e.target.value)} className={inputCls} placeholder="1.0" /></BinanceInsetField>}
          <BinanceInsetField label={t('terminal.dualPanel.amt')} suffix={baseAsset}>
            <input
              type="text"
              inputMode="decimal"
              value={sellQty}
              onChange={(e) => setSellQty(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </BinanceInsetField>
          <div className="flex items-center gap-2">
            {SLIDER_PCTS.filter(Boolean).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSellSlider(p)}
                className={`flex-1 rounded py-1.5 text-center terminal-text-label font-medium leading-none transition-all duration-150 active:scale-[0.98] ${
                  sellSlider >= p ? 'bg-sell/15 text-sell ring-1 ring-sell/25' : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <BinanceInsetField label={t('terminal.dualPanel.total')} suffix={quoteAsset}>
            <span className={`${inputCls} ${sellTotal ? 'text-foreground' : 'text-muted-foreground'}`}>{sellTotal || '—'}</span>
          </BinanceInsetField>
          <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 terminal-text-meta leading-snug">
            <span className="text-muted-foreground">{t('terminal.dualPanel.youPay')}</span>
            <span className="numeric text-right text-foreground">
              {sellQtyNum > 0 ? `${formatFixedTrim(sellQtyNum, qtyPrecision)} ${baseAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.youReceive')}</span>
            <span className="numeric text-right text-foreground">
              {sellNotional > 0 ? `${formatFixedTrim(sellNotional, quoteFormDisplayDp)} ${quoteAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.estimatedFee', { pct: (estimatedFeeRate * 100).toFixed(3) })}</span>
            <span className="numeric text-right text-foreground">
              {sellFeeQuote > 0 ? `${formatFixedTrim(sellFeeQuote, quoteFormDisplayDp)} ${quoteAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.netReceive')}</span>
            <span className="numeric text-right text-sell">
              {sellNetQuote > 0 ? `${formatFixedTrim(sellNetQuote, quoteFormDisplayDp)} ${quoteAsset}` : '—'}
            </span>
            <span className="text-muted-foreground">{t('terminal.dualPanel.estimatedExecution')}</span>
            <span className="numeric text-right text-foreground">
              {`${executionMode} · ${executionHint}`}
            </span>
          </div>
          {!isAuth ? (
            <Link
              href={loginWithRedirect(SPOT_TRADE_HREF)}
              className="flex h-10 min-h-[40px] items-center justify-center rounded-lg border border-sell/30 bg-sell/90 text-price font-semibold tracking-wide text-neutral-950 shadow-sm transition-all hover:bg-sell active:scale-[0.99] active:brightness-95"
            >
              {t('terminal.logIn')}
            </Link>
          ) : (
            <button
              type="button"
              data-spot-place-order
              data-spot-side="sell"
              disabled={submitting || !sellQty.trim() || !tradingEnabled}
              onClick={doSell}
              className="flex h-10 min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-sell/30 bg-sell/90 text-price font-semibold tracking-wide text-neutral-950 shadow-sm transition-all hover:bg-sell active:scale-[0.99] active:brightness-95 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting && side === 'sell' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('terminal.sellAsset', { asset: baseAsset })}
            </button>
          )}
          </div>
        </div>
      </div>
      {!tradingEnabled && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-2 terminal-text-label text-amber-300">
          {t('terminal.feedUnavailable')}
        </div>
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('terminal.confirmOrder')}</DialogTitle>
            <DialogDescription>{t('terminal.confirmOrderDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">{t('trading.buy')}/{t('trading.sell')}:</span>{' '}
              <span className={pendingOrder?.side === 'buy' ? 'text-buy font-semibold' : 'text-sell font-semibold'}>
                {(pendingOrder?.side ?? side) === 'buy' ? t('trading.buy') : t('trading.sell')}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t('terminal.typeLabel')}:</span> {orderTypeLabels[orderType]}
            </p>
            {(orderType === 'limit' || orderType === 'stop_limit') && (
              <p>
                <span className="text-muted-foreground">{t('terminal.priceLabel')}:</span> {price || '—'} {quoteAsset}
              </p>
            )}
            {(orderType === 'stop_loss' || orderType === 'stop_limit') && (
              <p>
                <span className="text-muted-foreground">{t('terminal.triggerLabel')}:</span> {stopPrice || '—'} {quoteAsset}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t('terminal.quantityLabel')}:</span> {pendingOrder?.qty || '—'}{' '}
              {baseAsset}
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() => setConfirmOpen(false)}
            >
              {tCommon('actions.cancel')}
            </button>
            <button
              type="button"
              disabled={submitting || !pendingOrder}
              className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              onClick={() => {
                if (!pendingOrder) return;
                void submitOrder(pendingOrder.side, pendingOrder.qty);
              }}
            >
              {submitting ? t('trading.executing') : tCommon('actions.confirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export interface SpotTradingGridTerminalProps {
  markets: Market[];
  sortedMarkets: Market[];
  symbol: string;
  setSymbolAndUrl: (s: string) => void;
  isAuth: boolean;
  userTierLevel?: number;
  chartTheme: 'dark' | 'light';
  chartIntervalSeconds: number;
  setChartIntervalSeconds: (v: number) => void;
  chartViewMode: 'chart' | 'depth';
  setChartViewMode: (m: 'chart' | 'depth') => void;
  isFavorite: (s: string) => boolean;
  toggleFavorite: (s: string) => void;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market' | 'stop_loss' | 'stop_limit' | 'trailing_stop_market';
  timeInForce: 'gtc' | 'ioc' | 'fok';
  postOnly: boolean;
  price: string;
  stopPrice: string;
  trailingDelta: string;
  submitting: boolean;
  submitError: string | null;
  setSubmitError: (v: string | null) => void;
  ordersVersion: number;
  tradesVersion: number;
  handleSideChange: (s: 'buy' | 'sell') => void;
  setOrderType: (t: 'limit' | 'market' | 'stop_loss' | 'stop_limit' | 'trailing_stop_market') => void;
  setPrice: (v: string) => void;
  setStopPrice: (v: string) => void;
  setTrailingDelta: (v: string) => void;
  setQuantity: (v: string) => void;
  setTimeInForce: (t: 'gtc' | 'ioc' | 'fok') => void;
  setPostOnly: (v: boolean) => void;
  handleSubmit: (overrideSide?: 'buy' | 'sell', overrideQty?: string) => Promise<void>;
  handlePriceClick: (p: string, q: string) => void;
  availableBalance: string;
  quoteBalance: string;
  baseBalance: string;
  requireOrderConfirmation: boolean;
  requireCancelAllConfirmation: boolean;
  preferencesSyncIssue?: boolean;
}

export function SpotTradingGridTerminal(props: SpotTradingGridTerminalProps) {
  const {
    markets,
    sortedMarkets,
    symbol,
    setSymbolAndUrl,
    isAuth,
    userTierLevel,
    chartTheme,
    chartIntervalSeconds,
    setChartIntervalSeconds,
    chartViewMode,
    setChartViewMode,
    isFavorite,
    toggleFavorite,
    side,
    orderType,
    timeInForce,
    postOnly,
    price,
    stopPrice,
    trailingDelta,
    submitting,
    submitError,
    setSubmitError,
    ordersVersion,
    tradesVersion,
    handleSideChange,
    setOrderType,
    setPrice,
    setStopPrice,
    setTrailingDelta,
    setQuantity,
    setTimeInForce,
    setPostOnly,
    handleSubmit,
    handlePriceClick,
    availableBalance,
    quoteBalance,
    baseBalance,
    requireOrderConfirmation,
    requireCancelAllConfirmation,
    preferencesSyncIssue = false,
  } = props;

  const t = useTranslations('crypto');
  const tCommon = useTranslations('common');
  const tChrome = useTranslations('crypto.terminalChrome');
  const panelError = (panelKey: 'orderBook' | 'orderForm' | 'orderHistory') =>
    t('panels.errorHit', { panel: t(`panels.${panelKey}`) });
  const { reconnectAttempt, streamPhase, privateChannelsReady, bootstrapIssue, lastRttMs, liteMode, liteHint } =
    useSpotMarketStream();
  const { ticker } = useSpotMarketTicker();
  const { orderbook } = useSpotMarketOrderbook();
  const { recentTrades } = useSpotMarketTrades();
  const { chartGrowPct, splitRootRef, splitBarProps } = useChartOrderVerticalSplit();
  const [topMoversExpanded, setTopMoversExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<SpotMobileTab>('chart');

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SPOT_MOBILE_TAB_STORAGE_KEY);
      if (saved === 'chart' || saved === 'book' || saved === 'trade' || saved === 'markets') {
        setMobileTab(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SPOT_MOBILE_TAB_STORAGE_KEY, mobileTab);
    } catch {
      /* ignore */
    }
  }, [mobileTab]);

  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol), [markets, symbol]);
  const baseAsset = selectedMarket?.base_asset ?? '';
  const quoteAsset = selectedMarket?.quote_asset ?? '';
  const pricePrecision = selectedMarket?.price_precision ?? 6;
  const qtyPrecision = selectedMarket?.qty_precision ?? 6;
  const effectiveMarketStatus = String(ticker?.status ?? selectedMarket?.status ?? 'ACTIVE').toUpperCase();
  const marketTradingOpen = effectiveMarketStatus === 'ACTIVE';
  const marketContext = useMemo(() => {
    const high = Number(ticker?.high_24h ?? selectedMarket?.high_24h ?? NaN);
    const low = Number(ticker?.low_24h ?? selectedMarket?.low_24h ?? NaN);
    const last = Number(ticker?.last_price ?? selectedMarket?.last_price ?? NaN);
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(last) || high <= low) {
      return null;
    }
    const range = high - low;
    const positionPct = Math.min(100, Math.max(0, ((last - low) / range) * 100));
    const distFromHighPct = high > 0 ? ((high - last) / high) * 100 : NaN;
    const distFromLowPct = low > 0 ? ((last - low) / low) * 100 : NaN;
    return {
      high,
      low,
      last,
      positionPct,
      distFromHighPct,
      distFromLowPct,
    };
  }, [ticker?.high_24h, ticker?.low_24h, ticker?.last_price, selectedMarket?.high_24h, selectedMarket?.low_24h, selectedMarket?.last_price]);

  const marketPulse = useMemo(() => {
    const changePct = Number(ticker?.change_pct ?? selectedMarket?.change_pct ?? NaN);
    const high = Number(ticker?.high_24h ?? selectedMarket?.high_24h ?? NaN);
    const low = Number(ticker?.low_24h ?? selectedMarket?.low_24h ?? NaN);
    const open = Number(ticker?.open_24h ?? selectedMarket?.open_24h ?? NaN);
    const bestBid = Number(orderbook?.bids?.[0]?.price ?? NaN);
    const bestAsk = Number(orderbook?.asks?.[0]?.price ?? NaN);
    const bidQty = Number(orderbook?.bids?.[0]?.quantity ?? NaN);
    const askQty = Number(orderbook?.asks?.[0]?.quantity ?? NaN);
    const tape = recentTrades.slice(0, 20);
    const buyCount = tape.filter((t) => t.side === 'buy').length;
    const sellCount = tape.filter((t) => t.side === 'sell').length;
    const momentum = Number.isFinite(changePct)
      ? Math.abs(changePct) >= 0.01
        ? changePct > 0
          ? 'Up'
          : 'Down'
        : 'Flat'
      : 'Unknown';
    const spreadPct =
      Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestAsk > bestBid
        ? ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100
        : NaN;
    const liquidity = !Number.isFinite(spreadPct)
      ? 'Unknown'
      : spreadPct < 0.08
        ? 'High'
        : spreadPct < 0.2
          ? 'Medium'
          : 'Thin';
    const volatilityPct =
      Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(open) && open > 0
        ? ((high - low) / open) * 100
        : NaN;
    const volatility =
      Number.isFinite(volatilityPct) && volatilityPct >= 6
        ? 'High'
        : Number.isFinite(volatilityPct) && volatilityPct >= 2
          ? 'Medium'
          : 'Low';
    const microImbalance =
      Number.isFinite(bidQty) && Number.isFinite(askQty) && bidQty + askQty > 0
        ? ((bidQty - askQty) / (bidQty + askQty)) * 100
        : 0;
    const tapeBias = buyCount - sellCount;
    const biasScore = (Number.isFinite(changePct) ? changePct : 0) + microImbalance * 0.1 + tapeBias * 0.2;
    const marketBias = biasScore > 0.8 ? 'Bullish' : biasScore < -0.8 ? 'Bearish' : 'Neutral';
    return { momentum, liquidity, volatility, marketBias };
  }, [
    ticker?.change_pct,
    ticker?.high_24h,
    ticker?.low_24h,
    ticker?.open_24h,
    selectedMarket?.change_pct,
    selectedMarket?.high_24h,
    selectedMarket?.low_24h,
    selectedMarket?.open_24h,
    orderbook?.bids,
    orderbook?.asks,
    recentTrades,
  ]);
  /** Above-the-fold height: one viewport; mobile subtracts bottom nav padding area from layout. */
  const aboveFoldH =
    'h-[calc(100dvh-3.75rem-env(safe-area-inset-bottom,0px))] md:h-[100dvh]';

  return (
    <div className="terminal-shell relative w-full bg-background">
      {/* ── ABOVE THE FOLD: fixed viewport, no page scroll inside this block ── */}
      <div className={`relative flex shrink-0 flex-col overflow-hidden ${aboveFoldH}`}>
        <div
          className="spot-terminal-grid box-border min-h-0 w-full flex-1"
          data-mobile-tab={mobileTab}
          style={{
            display: 'grid',
            gridTemplateColumns: 'var(--spot-terminal-left-width) 1fr var(--spot-terminal-right-width)',
            gridTemplateRows: '40px auto minmax(0, 1fr)',
          }}
        >
          {/* HEADER */}
          <div
            className="spot-terminal-header terminal-panel border-b border-border bg-card"
            style={{ gridColumn: '1 / -1', gridRow: '1' }}
          >
            <ExchangeHeader
              terminalChrome
              showPairSearch
              currentSymbol={symbol}
              symbols={markets.map((m) => m.symbol)}
              onSymbolSelect={setSymbolAndUrl}
            />
          </div>

          {/* PAIR HEADER (orderbook + center only; sidebar aligns to full main height) */}
          <div
            className="spot-terminal-pair-header terminal-panel-elevated flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-r border-solid border-border bg-card"
            style={{ gridColumn: '1 / 3', gridRow: '2' }}
          >
            <SpotPairHeaderSection
              symbol={symbol} baseAsset={baseAsset} quoteAsset={quoteAsset} pricePrecision={pricePrecision}
              sortedMarkets={sortedMarkets} onSymbolChange={setSymbolAndUrl}
              isFavorite={isFavorite} onToggleFavorite={toggleFavorite} tierLevel={userTierLevel}
              marketStatus={effectiveMarketStatus}
            />
            <SpotTerminalStatusRow
              streamPhase={streamPhase}
              lastRttMs={lastRttMs}
              liteMode={liteMode}
              liteHint={liteHint}
              marketTradingOpen={marketTradingOpen}
              effectiveMarketStatus={effectiveMarketStatus}
              isAuth={isAuth}
              privateChannelsReady={privateChannelsReady}
              preferencesSyncIssue={preferencesSyncIssue}
              bootstrapIssue={bootstrapIssue}
              reconnectAttempt={reconnectAttempt}
              marketContext={marketContext}
              marketPulse={marketPulse}
            />
          </div>

          {/* RIGHT SIDEBAR: Binance-style row split — market list / trades / movers (no outer scroll) */}
          <div
            data-spot-rail
            className="spot-terminal-markets terminal-panel-subtle grid min-h-0 min-w-0 overflow-hidden border-b border-l border-solid border-border bg-card"
            style={{
              gridColumn: '3',
              gridRow: '2 / 4',
              gridTemplateRows: topMoversExpanded
                ? 'minmax(0, 1.85fr) minmax(0, 1.05fr) minmax(0, 2.55fr)'
                : 'minmax(0, 2.45fr) minmax(0, 1.65fr) auto',
            }}
          >
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-solid border-border">
              <RightMarketListSection
                sortedMarkets={sortedMarkets} symbol={symbol} onSymbolChange={setSymbolAndUrl}
                isFavorite={isFavorite} onToggleFavorite={toggleFavorite}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-solid border-border">
              <RecentTradesPanel baseAsset={baseAsset} quoteAsset={quoteAsset} pricePrecision={pricePrecision} qtyPrecision={qtyPrecision} />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <TopMoversSection
                sortedMarkets={sortedMarkets}
                symbol={symbol}
                onSymbolChange={setSymbolAndUrl}
                expanded={topMoversExpanded}
                onToggleExpand={() => setTopMoversExpanded((v) => !v)}
              />
            </div>
          </div>

          {/* ORDERBOOK */}
          <div
            data-spot-rail
            className="spot-terminal-orderbook terminal-panel-subtle flex min-w-0 flex-col overflow-hidden border-r border-solid border-border bg-card"
            style={{ gridColumn: '1', gridRow: '3' }}
          >
            <PanelErrorBoundary
              name="Order Book"
              errorMessage={panelError('orderBook')}
              retryLabel={tCommon('actions.retry')}
              resetKey={symbol}
            >
              <SpotOrderbookSection quoteAsset={quoteAsset} baseAsset={baseAsset} pricePrecision={pricePrecision} qtyPrecision={qtyPrecision} onPriceClick={handlePriceClick} />
            </PanelErrorBoundary>
          </div>

          {/* CENTER: resizable vertical split — chart vs order form (ratio persisted per session) */}
          <div
            ref={splitRootRef}
            className="spot-terminal-center terminal-panel-elevated flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-solid border-border bg-card"
            style={{ gridColumn: '2', gridRow: '3' }}
          >
            <div
              className="spot-terminal-chart-pane relative flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border"
              style={{
                flexGrow: chartGrowPct,
                flexShrink: 1,
                flexBasis: 0,
                minHeight: 120,
              }}
            >
              <SpotChartSection
                symbol={symbol} baseAsset={baseAsset} quoteAsset={quoteAsset} pricePrecision={pricePrecision}
                chartIntervalSeconds={chartIntervalSeconds} chartTheme={chartTheme} chartViewMode={chartViewMode}
                onIntervalSecondsChange={setChartIntervalSeconds} onViewModeChange={setChartViewMode}
              />
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label={tChrome('resizeChartAria')}
              className="spot-terminal-split-bar relative z-[1] h-2 shrink-0 cursor-row-resize touch-none border-y border-border bg-muted/40 transition-colors hover:border-primary/20 hover:bg-muted/70"
              {...splitBarProps}
            />
            <div
              className="spot-terminal-trade-pane flex min-h-0 flex-col overflow-hidden border-t border-border bg-card"
              style={{
                flexGrow: 100 - chartGrowPct,
                flexShrink: 1,
                flexBasis: 0,
                minHeight: 248,
              }}
            >
              <PanelErrorBoundary
                name="Order Form"
                errorMessage={panelError('orderForm')}
                retryLabel={tCommon('actions.retry')}
                resetKey={symbol}
              >
              <BinanceOrderEntrySection
                orderType={orderType} setOrderType={setOrderType} timeInForce={timeInForce} setTimeInForce={setTimeInForce}
                postOnly={postOnly} setPostOnly={setPostOnly} price={price} setPrice={setPrice}
                stopPrice={stopPrice} setStopPrice={setStopPrice} trailingDelta={trailingDelta} setTrailingDelta={setTrailingDelta}
                baseAsset={baseAsset} quoteAsset={quoteAsset} pricePrecision={pricePrecision} qtyPrecision={qtyPrecision}
                isAuth={isAuth} submitting={submitting} handleSubmit={handleSubmit} handleSideChange={handleSideChange}
                setQuantity={setQuantity} selectedMarket={selectedMarket} availableBalance={availableBalance}
                quoteBalance={quoteBalance} baseBalance={baseBalance} side={side}
                requireOrderConfirmation={requireOrderConfirmation}
                tradingEnabled={streamPhase === 'live' && marketTradingOpen}
                marketStatus={effectiveMarketStatus}
              />
              </PanelErrorBoundary>
            </div>
          </div>

          <nav
            className="spot-terminal-mobile-tabs shrink-0 items-stretch border-t border-border bg-card"
            role="tablist"
            aria-label={tChrome('panelsAria')}
          >
            {SPOT_MOBILE_TAB_IDS.map((tabId) => (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={mobileTab === tabId}
                onClick={() => setMobileTab(tabId)}
                className={`terminal-tab ${mobileTab === tabId ? 'terminal-tab--active' : ''}`}
              >
                {t(`terminal.mobileTabs.${tabId}`)}
              </button>
            ))}
          </nav>
        </div>

        {/* Stream status shown via SpotTerminalStatusRow — no overlay banners */}

        {/* Error banner — bottom of above-fold main area */}
        {submitError && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-16 items-center gap-2 border-t border-sell/30 bg-sell/15 px-4 py-2 text-label text-sell md:left-[var(--spot-terminal-left-width)] md:right-[var(--spot-terminal-right-width)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">{submitError}</span>
            <button type="button" onClick={() => setSubmitError(null)} className="shrink-0 font-semibold underline">{t('bottomPanel.dismiss')}</button>
          </div>
        )}
      </div>

      {/* ── BELOW THE FOLD: order history — page scrolls here ── */}
      <section className="w-full border-t border-border bg-card" aria-label={tChrome('bottomSectionAria')}>
        <PanelErrorBoundary
          name="Order History"
          errorMessage={panelError('orderHistory')}
          retryLabel={tCommon('actions.retry')}
          resetKey={symbol}
        >
          <SpotBottomPanel
            symbol={symbol}
            isAuth={isAuth}
            ordersVersion={ordersVersion}
            tradesVersion={tradesVersion}
            promptCancelAllConfirmation={requireCancelAllConfirmation}
            markets={markets.map((m) => ({
              symbol: m.symbol,
              price_precision: m.price_precision,
              qty_precision: m.qty_precision,
            }))}
          />
        </PanelErrorBoundary>
      </section>
    </div>
  );
}
