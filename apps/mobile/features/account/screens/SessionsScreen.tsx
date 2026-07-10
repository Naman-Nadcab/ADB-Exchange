import { useEffect } from 'react';
import { FlatList, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useSessions } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Sessions'>;

export function SessionsScreen(_props: Props) {
  const q = useSessions();

  useEffect(() => {
    analytics.screen('S-716');
  }, []);

  return (
    <ScreenLayout testID="S-716">
      <PrimaryButton title="Logout other devices" onPress={() => void getAuthRepository().logoutAllOther()} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <Text style={{ paddingVertical: 10 }}>
            {item.device ?? 'Device'} · {item.last_active_at ? new Date(item.last_active_at).toLocaleString() : ''}
            {item.current ? ' (current)' : ''}
          </Text>
        )}
      />
    </ScreenLayout>
  );
}
