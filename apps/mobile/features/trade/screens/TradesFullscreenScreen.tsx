import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { RecentTradesList } from '../components/RecentTradesList';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'TradesFullscreen'>;

export function TradesFullscreenScreen({ route }: Props) {
  const { symbol } = route.params;
  const { trades } = useTradeScreenData(symbol);

  useEffect(() => {
    analytics.screen('S-304');
  }, []);

  return (
    <ScreenLayout testID="S-304">
      <ScrollView>
        <RecentTradesList trades={trades ?? []} maxRows={50} />
      </ScrollView>
    </ScreenLayout>
  );
}
