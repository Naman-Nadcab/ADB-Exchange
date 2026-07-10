import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { OrderBookLadder } from '../components/OrderBookLadder';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'OrderbookFullscreen'>;

export function OrderbookFullscreenScreen({ route }: Props) {
  const { symbol } = route.params;
  const { orderbook } = useTradeScreenData(symbol);

  useEffect(() => {
    analytics.screen('S-303');
  }, []);

  return (
    <ScreenLayout testID="S-303">
      <ScrollView>
        <OrderBookLadder book={orderbook} maxRows={25} />
      </ScrollView>
    </ScreenLayout>
  );
}
