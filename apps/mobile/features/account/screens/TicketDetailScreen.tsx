import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getSupportRepository } from '@core/repositories/UserRepository';
import type { AccountStackParamList } from '../navigation/types';
import type { SupportTicketDetail } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<AccountStackParamList, 'TicketDetail'>;

export function TicketDetailScreen({ route }: Props) {
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    analytics.screen('S-764');
    void getSupportRepository().getTicket(route.params.id).then(setTicket);
  }, [route.params.id]);

  const send = async () => {
    await getSupportRepository().replyToTicket(route.params.id, reply);
    const t = await getSupportRepository().getTicket(route.params.id);
    setTicket(t);
    setReply('');
  };

  if (!ticket) return <ScreenLayout testID="S-764"><Text>Loading…</Text></ScreenLayout>;

  return (
    <ScreenLayout testID="S-764">
      <Text style={{ fontWeight: '700' }}>{ticket.subject}</Text>
      <Text style={{ marginBottom: 12 }}>{ticket.status}</Text>
      <FlatList
        data={ticket.messages ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Text style={{ paddingVertical: 6 }}>
            [{item.sender_type}] {item.message}
          </Text>
        )}
      />
      <TextField label="Reply" value={reply} onChangeText={setReply} />
      <PrimaryButton title="Send reply" onPress={() => void send()} />
    </ScreenLayout>
  );
}
