import { useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, CandleChart, DepthChart, ChartToolbar } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useTradeStore } from '@core/state/tradeStore';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { CHART_INTERVALS } from '../components/CandleChart';
import { useLiveCandles } from '../hooks/useLiveCandles';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import type { ChartTradeMarker } from '@shared/ui/charts/CandleChart';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'ChartFullscreen'>;

const INTERVAL_TABS = CHART_INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }));

export function ChartFullscreenScreen({ route }: Props) {
  const { symbol } = route.params;
  const interval = useTradeStore((s) => s.chartInterval);
  const chartViewMode = useTradeStore((s) => s.chartViewMode);
  const chartStudies = useTradeStore((s) => s.chartStudies);
  const setChartInterval = useTradeStore((s) => s.setChartInterval);
  const setChartViewMode = useTradeStore((s) => s.setChartViewMode);
  const setChartStudies = useTradeStore((s) => s.setChartStudies);
  const { orderbook, trades } = useTradeScreenData(symbol);
  const live = useMarketDataStore((s) => s.live[symbol]);
  const { data: candles } = useLiveCandles(symbol, interval, trades ?? [], true);

  const tradeMarkers = useMemo((): ChartTradeMarker[] => {
    return (trades ?? []).slice(0, 40).map((t) => {
      const ts =
        t.timestamp ??
        (t.time ? Math.floor(Date.parse(t.time) / 1000) : t.created_at ? Math.floor(Date.parse(t.created_at) / 1000) : 0);
      return {
        time: Math.floor(ts / interval) * interval,
        price: parseFloat(t.price),
        side: t.side === 'buy' ? 'buy' : 'sell',
      };
    });
  }, [trades, interval]);

  useEffect(() => {
    useTradeStore.getState().hydrate();
    if (route.params.interval && route.params.interval !== interval) {
      setChartInterval(route.params.interval);
    }
    analytics.screen('S-302');
  }, [route.params.interval, interval, setChartInterval]);

  return (
    <ScreenLayout testID="S-302">
      <ScrollView>
        <SegmentControl tabs={INTERVAL_TABS} active={String(interval)} onChange={(id) => setChartInterval(Number(id))} />
        <ChartToolbar
          viewMode={chartViewMode}
          onViewModeChange={setChartViewMode}
          studies={chartStudies}
          onStudiesChange={setChartStudies}
        />
        {chartViewMode === 'depth' ? (
          <DepthChart bids={orderbook?.bids ?? []} asks={orderbook?.asks ?? []} height={400} />
        ) : (
          <CandleChart
            candles={candles ?? []}
            height={400}
            studies={chartStudies}
            tradeMarkers={tradeMarkers}
            livePrice={live?.lastPrice}
          />
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
