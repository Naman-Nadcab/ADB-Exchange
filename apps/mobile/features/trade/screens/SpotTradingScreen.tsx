import { useEffect, useState, useMemo, useCallback } from 'react';
import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CandleChart,
  CHART_INTERVALS,
  ScreenLayout,
  TerminalTabs,
  SkeletonList,
  TerminalPanel,
  SegmentControl,
  PrimaryButton,
} from '@shared/ui';
import { useGuestAccess } from '@features/auth';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useTicker } from '@features/markets';
import { useTradeStore } from '@core/state/tradeStore';
import { useWsClient } from '@app/providers/WsProvider';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { PairHeader } from '../components/PairHeader';
import { OrderBookLadder } from '../components/OrderBookLadder';
import { RecentTradesList } from '../components/RecentTradesList';
import { OrderForm } from '../components/OrderForm';
import { OpenOrdersPeek } from '../components/OpenOrdersPeek';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import { useOpenOrders, useTradingBalances, useCandles, useMarketsMeta } from '../hooks/useTrade';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'SpotTrading'>;
type TradeTab = 'chart' | 'book' | 'trade' | 'orders';

const INTERVAL_TABS = CHART_INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }));

export function SpotTradingScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { isGuest, openLogin } = useGuestAccess();
  const symbol = route.params?.symbol ?? useTradeStore.getState().symbol;
  const side = useTradeStore((s) => s.side);
  const setSymbol = useTradeStore((s) => s.setSymbol);
  const setSide = useTradeStore((s) => s.setSide);
  const [presetPrice, setPresetPrice] = useState<string | undefined>();
  const [interval, setInterval] = useState(300);
  const [tab, setTab] = useState<TradeTab>('chart');
  const wsState = useWsClient().getState();

  useEffect(() => {
    useTradeStore.getState().hydrate();
    analytics.screen('S-300');
  }, []);

  useEffect(() => {
    if (route.params?.symbol) setSymbol(route.params.symbol);
  }, [route.params?.symbol, setSymbol]);

  const { data: ticker } = useTicker(symbol);
  const { orderbook, trades } = useTradeScreenData(symbol);
  const live = useMarketDataStore((s) => s.live[symbol]);
  const { data: candles, isLoading: candlesLoading } = useCandles(symbol, interval);
  const { data: openOrders } = useOpenOrders();
  const { data: balances } = useTradingBalances();
  const { data: markets } = useMarketsMeta();

  const marketMeta = useMemo(
    () => markets?.find((m) => m.symbol === symbol),
    [markets, symbol],
  );

  const quoteAsset = marketMeta?.quote_asset ?? ticker?.quote_asset ?? 'USDT';
  const baseAsset = marketMeta?.base_asset ?? ticker?.base_asset ?? symbol.split('_')[0];
  const available =
    balances?.balances.find((b) => b.symbol === (side === 'buy' ? quoteAsset : baseAsset))?.equity ?? '0';

  const symbolOrders = (openOrders ?? []).filter((o) => o.market === symbol);

  const goOrdersTab = useCallback(() => {
    navigation.getParent()?.navigate('Orders');
  }, [navigation]);

  return (
    <ScreenLayout testID="S-300" padded={false} style={{ backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }}>
      <View style={{ paddingHorizontal: theme.spacing.pageX }}>
        <PairHeader
          symbol={symbol}
          ticker={ticker}
          livePrice={live?.lastPrice}
          liveChange={live?.changePct}
          wsState={wsState}
          onSwitchPair={() => navigation.navigate('PairSelector')}
        />

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
            <SegmentControl
              tabs={INTERVAL_TABS}
              active={String(interval)}
              onChange={(id) => setInterval(Number(id))}
            />
            {candlesLoading && !candles ? (
              <SkeletonList rows={4} />
            ) : (
              <TerminalPanel padded={false} style={styles.chartPanel}>
                <CandleChart candles={candles ?? []} height={280} />
              </TerminalPanel>
            )}
            <Pressable onPress={() => navigation.navigate('ChartFullscreen', { symbol, interval })} style={styles.link}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
                Expand chart ↗
              </Text>
            </Pressable>
          </View>
        )}

        {tab === 'book' && (
          <View style={styles.bookLayout}>
            <View style={styles.bookCol}>
              <OrderBookLadder
                book={orderbook}
                onSelectPrice={(p) => {
                  setPresetPrice(p);
                  setTab('trade');
                }}
                maxRows={12}
              />
            </View>
            <View style={styles.bookCol}>
              <RecentTradesList trades={trades ?? []} maxRows={14} />
            </View>
            <Pressable onPress={() => navigation.navigate('OrderbookFullscreen', { symbol })} style={styles.link}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
                Full order book ↗
              </Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TradesFullscreen', { symbol })} style={styles.link}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
                All trades ↗
              </Text>
            </Pressable>
          </View>
        )}

        {tab === 'trade' && (
          <View>
            <TerminalPanel subtle style={styles.bookPeek}>
              <OrderBookLadder
                book={orderbook}
                onSelectPrice={(p) => setPresetPrice(p)}
                maxRows={5}
              />
            </TerminalPanel>
            {isGuest ? (
              <TerminalPanel style={{ marginTop: theme.spacing[3] }}>
                <Text
                  style={{
                    color: `hsl(${theme.colors.foregroundSecondary})`,
                    textAlign: 'center',
                    marginBottom: theme.spacing[4],
                  }}
                >
                  Sign in to place spot orders on {symbol.replace('_', '/')}
                </Text>
                <PrimaryButton title="Sign in to Trade" size="xl" onPress={() => openLogin()} />
              </TerminalPanel>
            ) : (
              <OrderForm
                symbol={symbol}
                side={side}
                market={marketMeta}
                availableBalance={available}
                quoteAsset={quoteAsset}
                baseAsset={baseAsset}
                onSideChange={setSide}
                presetPrice={presetPrice}
              />
            )}
          </View>
        )}

        {tab === 'orders' && (
          <View>
            {isGuest ? (
              <TerminalPanel>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>
                  Sign in to view and manage open orders
                </Text>
                <PrimaryButton title="Sign in to Trade" size="md" onPress={() => openLogin()} style={{ marginTop: 12 }} />
              </TerminalPanel>
            ) : (
              <>
                <OpenOrdersPeek orders={symbolOrders} symbol={symbol} onViewAll={goOrdersTab} />
                {symbolOrders.length === 0 ? (
                  <TerminalPanel>
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>
                      No open orders for this pair
                    </Text>
                  </TerminalPanel>
                ) : null}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  chartPanel: { marginBottom: 8 },
  link: { marginTop: 10, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  bookLayout: { flexDirection: 'row', gap: 8 },
  bookCol: { flex: 1 },
  bookPeek: { marginBottom: 10, maxHeight: 180, overflow: 'hidden' },
});
