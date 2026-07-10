import { useEffect, useState, useMemo } from 'react';
import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, SkeletonList } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useTicker } from '@features/markets';
import { useTradeStore } from '@core/state/tradeStore';
import { useWsClient } from '@app/providers/WsProvider';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { PairHeader } from '../components/PairHeader';
import { OrderBookLadder } from '../components/OrderBookLadder';
import { RecentTradesList } from '../components/RecentTradesList';
import { CandleChart, INTERVALS } from '../components/CandleChart';
import { OrderForm } from '../components/OrderForm';
import { OpenOrdersPeek } from '../components/OpenOrdersPeek';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import { useOpenOrders, useTradingBalances, useCandles, useMarketsMeta } from '../hooks/useTrade';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'SpotTrading'>;

export function SpotTradingScreen({ navigation, route }: Props) {
  const symbol = route.params?.symbol ?? useTradeStore.getState().symbol;
  const side = useTradeStore((s) => s.side);
  const setSymbol = useTradeStore((s) => s.setSymbol);
  const setSide = useTradeStore((s) => s.setSide);
  const [presetPrice, setPresetPrice] = useState<string | undefined>();
  const [interval, setInterval] = useState(300);
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

  return (
    <ScreenLayout testID="S-300">
      <ScrollView keyboardShouldPersistTaps="handled">
        <PairHeader
          symbol={symbol}
          ticker={ticker}
          livePrice={live?.lastPrice}
          liveChange={live?.changePct}
          wsState={wsState}
          onSwitchPair={() => navigation.navigate('PairSelector')}
        />
        <View style={styles.links}>
          <Pressable onPress={() => navigation.navigate('ChartFullscreen', { symbol, interval })}>
            <Text style={styles.link}>Chart ↗</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('OrderbookFullscreen', { symbol })}>
            <Text style={styles.link}>Book ↗</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('TradesFullscreen', { symbol })}>
            <Text style={styles.link}>Trades ↗</Text>
          </Pressable>
        </View>
        <SegmentControl
          tabs={INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }))}
          active={String(interval)}
          onChange={(id) => setInterval(Number(id))}
        />
        {candlesLoading && !candles ? <SkeletonList rows={3} /> : <CandleChart candles={candles ?? []} />}
        <View style={styles.split}>
          <OrderBookLadder
            book={orderbook}
            onSelectPrice={(p) => setPresetPrice(p)}
            maxRows={8}
          />
          <RecentTradesList trades={trades ?? []} maxRows={8} />
        </View>
        <OrderForm
          symbol={symbol}
          side={side}
          market={marketMeta}
          availableBalance={available}
          quoteAsset={quoteAsset}
          onSideChange={setSide}
          presetPrice={presetPrice}
        />
        <OpenOrdersPeek orders={symbolOrders} symbol={symbol} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  link: { fontWeight: '600', fontSize: 13 },
  split: { flexDirection: 'row', gap: 8 },
});
