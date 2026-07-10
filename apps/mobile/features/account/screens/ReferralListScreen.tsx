import { useEffect } from 'react';
import { FlatList, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useReferrals } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralList'>;

export function ReferralListScreen(_props: Props) {
  const q = useReferrals();

  useEffect(() => {
    analytics.screen('S-743');
  }, []);

  return (
    <ScreenLayout testID="S-743">
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Text style={{ paddingVertical: 10 }}>
            {item.referred_user ?? item.id} · {item.status} · {item.commission ?? ''}
          </Text>
        )}
      />
    </ScreenLayout>
  );
}
