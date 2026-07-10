import { useEffect } from 'react';
import { FlatList, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useLoginActivity } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'LoginHistory'>;

export function LoginHistoryScreen(_props: Props) {
  const q = useLoginActivity();

  useEffect(() => {
    analytics.screen('S-704');
  }, []);

  return (
    <ScreenLayout testID="S-704">
      <FlatList
        data={q.data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Text style={{ paddingVertical: 10 }}>
            {item.action} · {item.ip ?? ''} · {new Date(item.created_at).toLocaleString()}
          </Text>
        )}
      />
    </ScreenLayout>
  );
}
