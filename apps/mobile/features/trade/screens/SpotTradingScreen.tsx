import { useEffect, useState, useMemo, useCallback } from 'react';
import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CandleChart, CHART_INTERVALS, ScreenLayout, TerminalTabs, SkeletonList, TerminalPanel } from '@shared/ui';
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

export function SpotTradingScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const symbol = route.params?.symbol ?? useTradeStore.getState().symbol;
  const side = useTradeStore((s) => s.side);
  const setSymbol = useTradeStore((s) => s.setSymbol);
  const setSide = useTradeStore((s) => s.setSide);
  const [presetPrice, setPresetPrice] = useState<string | undefined>();
  const [interval, setInterval] = useState(300);
  const [tab, setTab] = useState<TradeTab>('trade');
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
    <ScreenLayout testID="S-300">
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

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {tab === 'chart' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CHART_INTERVALS.map((i) => (
                <Pressable
                  key={i.sec}
                  onPress={() => setInterval(i.sec)}
                  style={[
                    styles.intervalChip,
                    {
                      backgroundColor:
                        interval === i.sec ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.surfaceMuted})`,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        interval === i.sec
                          ? `hsl(${theme.colors.brandPrimaryForeground})`
                          : `hsl(${theme.colors.foregroundPrimary})`,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {i.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {candlesLoading && !candles ? (
              <SkeletonList rows={4} />
            ) : (
              <TerminalPanel padded={false}>
                <CandleChart candles={candles ?? []} height={220} />
              </TerminalPanel>
            )}
            <Pressable onPress={() => navigation.navigate('ChartFullscreen', { symbol, interval })} style={styles.link}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Fullscreen chart ↗</Text>
            </Pressable>
          </View>
        )}

        {tab === 'book' && (
          <View style={styles.split}>
            <OrderBookLadder book={orderbook} onSelectPrice={(p) => { setPresetPrice(p); setTab('trade'); }} maxRows={10} />
            <RecentTradesList trades={trades ?? []} maxRows={12} />
          </View>
        )}

        {tab === 'trade' && (
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

        {tab === 'orders' && (
          <View>
            <OpenOrdersPeek orders={symbolOrders} symbol={symbol} onViewAll={goOrdersTab} />
            {symbolOrders.length === 0 ? (
              <TerminalPanel>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>
                  No open orders for this pair
                </Text>
              </TerminalPanel>
            ) : null}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  intervalChip: { paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, minHeight: 32, justifyContent: 'center' },
  link: { marginTop: 12, alignItems: 'center' },
  split: { gap: 8 },
});
