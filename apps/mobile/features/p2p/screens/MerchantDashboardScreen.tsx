import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useMerchantStats } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MerchantDashboard'>;

export function MerchantDashboardScreen(_props: Props) {
  const q = useMerchantStats();

  useEffect(() => {
    analytics.screen('S-613');
  }, []);

  const s = q.data ?? {};
  return (
    <ScreenLayout testID="S-613">
      <ScrollView>
        <Text>Total orders: {String(s.total_orders ?? '—')}</Text>
        <Text>Completed: {String(s.completed_orders ?? '—')}</Text>
        <Text>Completion rate: {String(s.completion_rate ?? '—')}%</Text>
        <Text>Avg rating: {String(s.average_rating ?? '—')}</Text>
        <Text>Avg release: {String(s.avg_release_time ?? '—')} min</Text>
      </ScrollView>
    </ScreenLayout>
  );
}
