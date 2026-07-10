import { useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { CandleChart, INTERVALS } from '../components/CandleChart';
import { useCandles } from '../hooks/useTrade';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'ChartFullscreen'>;

export function ChartFullscreenScreen({ route }: Props) {
  const { symbol } = route.params;
  const [interval, setInterval] = useState(route.params.interval ?? 300);
  const { data: candles } = useCandles(symbol, interval);

  useEffect(() => {
    analytics.screen('S-302');
  }, []);

  return (
    <ScreenLayout testID="S-302">
      <ScrollView>
        <SegmentControl
          tabs={INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }))}
          active={String(interval)}
          onChange={(id) => setInterval(Number(id))}
        />
        <CandleChart candles={candles ?? []} height={400} />
      </ScrollView>
    </ScreenLayout>
  );
}
