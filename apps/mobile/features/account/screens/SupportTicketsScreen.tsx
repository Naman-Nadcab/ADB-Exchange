import { useEffect } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useSupportTickets } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SupportTickets'>;

export function SupportTicketsScreen({ navigation }: Props) {
  const q = useSupportTickets();

  useEffect(() => {
    analytics.screen('S-762');
  }, []);

  return (
    <ScreenLayout testID="S-762">
      <PrimaryButton title="Create ticket" onPress={() => navigation.navigate('CreateTicket')} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 12 }} onPress={() => navigation.navigate('TicketDetail', { id: item.id })}>
            <Text style={{ fontWeight: '600' }}>{item.subject}</Text>
            <Text style={{ fontSize: 12 }}>{item.status}</Text>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
