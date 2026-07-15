import { useEffect, useState, useMemo, useCallback } from 'react';
import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CandleChart,
  CHART_INTERVALS,
  DepthChart,
  ChartToolbar,
  ScreenLayout,
  TerminalTabs,
  SkeletonList,
  TerminalPanel,
  SegmentControl,
  PrimaryButton,
  ErrorBanner,
  Loader,
} from '@shared/ui';
import { useGuestAccess } from '@features/auth';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { resolveSpotDisplayLastPrice } from '@core/domain/trade/spotPriceDisplay';
import { computeMarketContext, computeMarketPulse, streamPhaseFromWsState } from '@core/domain/trade/marketPulse';
import { useTicker } from '@features/markets';
import { useTradeStore } from '@core/state/tradeStore';
import { useAppStore } from '@core/state/appStore';
import { useWsMetricsStore } from '@core/state/wsMetricsStore';
import { useWsClient } from '@app/providers/WsProvider';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { PairHeader } from '../components/PairHeader';
import { SpotOrderbookPanel } from '../components/SpotOrderbookPanel';
import { DualOrderEntry } from '../components/DualOrderEntry';
import { SpotBottomPanel } from '../components/SpotBottomPanel';
import { SpotTerminalStatusRow } from '../components/SpotTerminalStatusRow';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import { useTradingBalances, useMarketsMeta } from '../hooks/useTrade';
import { useLiveCandles } from '../hooks/useLiveCandles';
import type { ChartTradeMarker } from '@shared/ui/charts/CandleChart';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'SpotTrading'>;
type TradeTab = 'chart' | 'book' | 'trade' | 'orders';

const INTERVAL_TABS = CHART_INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }));

export function SpotTradingScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { isGuest, openLogin } = useGuestAccess();
  const isOnline = useAppStore((s) => s.isOnline);
  const symbol = route.params?.symbol ?? useTradeStore.getState().symbol;
  const interval = useTradeStore((s) => s.chartInterval);
  const chartViewMode = useTradeStore((s) => s.chartViewMode);
  const chartStudies = useTradeStore((s) => s.chartStudies);
  const wsAuthenticated = useTradeStore((s) => s.wsAuthenticated);
  const setSymbol = useTradeStore((s) => s.setSymbol);
  const setChartInterval = useTradeStore((s) => s.setChartInterval);
  const setChartViewMode = useTradeStore((s) => s.setChartViewMode);
  const setChartStudies = useTradeStore((s) => s.setChartStudies);
  const [presetPrice, setPresetPrice] = useState<string | undefined>();
  const [presetQuantity, setPresetQuantity] = useState<string | undefined>();
  const [tab, setTab] = useState<TradeTab>('chart');
  const wsState = useWsClient().getState();
  const streamPhase = useWsMetricsStore((s) => s.streamPhase);
  const lastRttMs = useWsMetricsStore((s) => s.lastRttMs);
  const reconnectAttempt = useWsMetricsStore((s) => s.reconnectAttempt);
  const liteMode = useWsMetricsStore((s) => s.liteMode);
  const authEnabled = !isGuest;

  useEffect(() => {
    useTradeStore.getState().hydrate();
    analytics.screen('S-300');
  }, []);

  useEffect(() => {
    if (route.params?.symbol) setSymbol(route.params.symbol);
  }, [route.params?.symbol, setSymbol]);

  const { data: ticker, isLoading: tickerLoading } = useTicker(symbol);
  const { orderbook, trades, isLoading: bookLoading } = useTradeScreenData(symbol);
  const live = useMarketDataStore((s) => s.live[symbol]);
  const chartActive = tab === 'chart';
  const { data: candles, isLoading: candlesLoading } = useLiveCandles(symbol, interval, trades ?? [], chartActive);
  const { data: balances } = useTradingBalances(authEnabled);
  const { data: markets } = useMarketsMeta();

  const displayLastPrice = useMemo(
    () =>
      resolveSpotDisplayLastPrice({
        tickerLast: ticker?.last_price ?? (live?.lastPrice ? String(live.lastPrice) : null),
        orderbook,
        recentTrades: trades,
      }),
    [ticker?.last_price, live?.lastPrice, orderbook, trades],
  );

  const marketMeta = useMemo(() => markets?.find((m) => m.symbol === symbol), [markets, symbol]);
  const quoteAsset = marketMeta?.quote_asset ?? ticker?.quote_asset ?? 'USDT';
  const baseAsset = marketMeta?.base_asset ?? ticker?.base_asset ?? symbol.split('_')[0];

  const quoteBalance =
    balances?.balances.find((b) => b.symbol === quoteAsset)?.equity ?? '0';
  const baseBalance =
    balances?.balances.find((b) => b.symbol === baseAsset)?.equity ?? '0';

  const bestBid = orderbook?.bids?.[0]?.price ?? null;
  const bestAsk = orderbook?.asks?.[0]?.price ?? null;

  const effectiveMarketStatus = String(ticker?.status ?? marketMeta?.status ?? 'ACTIVE').toUpperCase();
  const marketTradingOpen = effectiveMarketStatus === 'ACTIVE';
  const tradingEnabled = streamPhase === 'live' && marketTradingOpen && isOnline;

  const lastNum = displayLastPrice ? parseFloat(displayLastPrice) : live?.lastPrice ?? NaN;
  const marketContext = useMemo(
    () =>
      computeMarketContext({
        high: live?.high24h ?? Number(ticker?.high_24h),
        low: live?.low24h ?? Number(ticker?.low_24h),
        last: Number.isFinite(lastNum) ? lastNum : Number(ticker?.last_price),
      }),
    [live?.high24h, live?.low24h, lastNum, ticker?.high_24h, ticker?.low_24h, ticker?.last_price],
  );

  const marketPulse = useMemo(
    () =>
      computeMarketPulse({
        changePct: live?.changePct ?? Number(ticker?.change_pct),
        high: live?.high24h ?? Number(ticker?.high_24h),
        low: live?.low24h ?? Number(ticker?.low_24h),
        open: Number(ticker?.open_24h),
        orderbook,
        recentTrades: trades,
      }),
    [live, ticker, orderbook, trades],
  );

  const tradeMarkers = useMemo((): ChartTradeMarker[] => {
    return (trades ?? []).slice(0, 40).map((t) => {
      const ts =
        t.timestamp ??
        (t.time ? Math.floor(Date.parse(t.time) / 1000) : t.created_at ? Math.floor(Date.parse(t.created_at) / 1000) : 0);
      const bucket = Math.floor(ts / interval) * interval;
      return {
        time: bucket,
        price: parseFloat(t.price),
        side: t.side === 'buy' ? 'buy' : 'sell',
      };
    });
  }, [trades, interval]);

  const handleBookSelect = useCallback((price: string, quantity: string) => {
    setPresetPrice(price);
    if (quantity) setPresetQuantity(quantity);
    setTab('trade');
  }, []);

  const offlineMessage =
    !isOnline
      ? 'Offline — order book and charts may be stale'
      : wsState !== 'connected'
        ? wsState === 'reconnecting'
          ? 'Reconnecting market stream…'
          : 'Market stream offline — showing last snapshot'
        : null;

  const initialLoading = tickerLoading && !ticker && !live?.lastPrice;

  return (
    <ScreenLayout testID="S-300" padded={false} style={{ backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }}>
      <View style={{ paddingHorizontal: theme.spacing.pageX }}>
        {initialLoading ? (
          <TerminalPanel style={{ marginBottom: 8 }}>
            <Loader />
          </TerminalPanel>
        ) : (
          <PairHeader
            symbol={symbol}
            ticker={ticker}
            livePrice={live?.lastPrice}
            liveChange={live?.changePct}
            liveHigh={live?.high24h}
            liveLow={live?.low24h}
            liveVolume={live?.volume24h}
            turnover24h={Number(ticker?.volume_24h ?? live?.volume24h ?? 0)}
            baseVolume24h={Number(ticker?.base_volume_24h ?? 0)}
            bestBid={bestBid}
            bestAsk={bestAsk}
            marketStatus={effectiveMarketStatus !== 'ACTIVE' ? effectiveMarketStatus : null}
            onSwitchPair={() => navigation.navigate('PairSelector')}
          />
        )}

        <SpotTerminalStatusRow
          streamPhase={streamPhaseFromWsState(wsState)}
          lastRttMs={lastRttMs}
          liteMode={liteMode}
          marketTradingOpen={marketTradingOpen}
          effectiveMarketStatus={effectiveMarketStatus}
          isAuth={authEnabled}
          privateChannelsReady={wsAuthenticated}
          reconnectAttempt={reconnectAttempt}
          marketContext={marketContext}
          marketPulse={marketPulse}
        />

        {offlineMessage ? <ErrorBanner message={offlineMessage} /> : null}

        <TerminalTabs
          tabs={[
            { id: 'chart', label: 'Chart' },
            { id: 'book', label: 'Book' },
            { id: 'trade', label: 'Trade' },
            { id: 'orders', label: 'Orders' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as TradeTab)}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.pageX, paddingBottom: 24 }}
      >
        {tab === 'chart' && (
          <View>
            <SegmentControl tabs={INTERVAL_TABS} active={String(interval)} onChange={(id) => setChartInterval(Number(id))} />
            <ChartToolbar
              viewMode={chartViewMode}
              onViewModeChange={setChartViewMode}
              studies={chartStudies}
              onStudiesChange={setChartStudies}
              streamLabel={
                streamPhase === 'live' && lastRttMs != null
                  ? `Stream live · ${lastRttMs}ms RTT · Pinch/drag chart`
                  : `Stream ${streamPhase} · Pinch/drag chart`
              }
            />
            {candlesLoading && !candles?.length && chartViewMode === 'candle' ? (
              <SkeletonList rows={4} />
            ) : (
              <TerminalPanel padded={false} style={styles.chartPanel}>
                {chartViewMode === 'depth' ? (
                  <DepthChart bids={orderbook?.bids ?? []} asks={orderbook?.asks ?? []} height={300} />
                ) : (
                  <CandleChart
                    candles={candles ?? []}
                    height={300}
                    studies={chartStudies}
                    tradeMarkers={tradeMarkers}
                    livePrice={live?.lastPrice}
                  />
                )}
              </TerminalPanel>
            )}
            <Pressable onPress={() => navigation.navigate('ChartFullscreen', { symbol, interval })} style={styles.link}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>Expand chart ↗</Text>
            </Pressable>
          </View>
        )}

        {tab === 'book' && (
          <SpotOrderbookPanel
            book={orderbook}
            recentTrades={trades ?? []}
            quoteAsset={quoteAsset}
            baseAsset={baseAsset}
            lastPrice={displayLastPrice}
            pricePrecision={marketMeta?.price_precision ?? 8}
            loading={bookLoading}
            onPriceClick={handleBookSelect}
            onTradePriceClick={handleBookSelect}
          />
        )}

        {tab === 'trade' && (
          <View>
            {isGuest ? (
              <TerminalPanel style={{ marginTop: theme.spacing[3] }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center', marginBottom: theme.spacing[4] }}>
                  Sign in to place spot orders on {symbol.replace('_', '/')}
                </Text>
                <PrimaryButton title="Sign in to Trade" size="xl" onPress={() => openLogin()} />
              </TerminalPanel>
            ) : (
              <DualOrderEntry
                symbol={symbol}
                market={marketMeta}
                quoteBalance={quoteBalance}
                baseBalance={baseBalance}
                quoteAsset={quoteAsset}
                baseAsset={baseAsset}
                lastPrice={displayLastPrice}
                orderbook={orderbook}
                tradingEnabled={tradingEnabled}
                presetPrice={presetPrice}
                presetQuantity={presetQuantity}
                privateChannelsReady={wsAuthenticated}
              />
            )}
          </View>
        )}

        {(tab === 'orders' || tab === 'trade') && (
          <SpotBottomPanel symbol={symbol} isAuth={authEnabled} markets={markets} />
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  chartPanel: { marginBottom: 8 },
  link: { marginTop: 10, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
});
