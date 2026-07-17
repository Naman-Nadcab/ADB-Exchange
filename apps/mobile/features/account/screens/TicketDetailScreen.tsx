import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { getSupportRepository } from '@core/repositories/UserRepository';
import type { AccountStackParamList } from '../navigation/types';
import type { SupportTicketDetail } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<AccountStackParamList, 'TicketDetail'>;

function ticketStatusTone(status: string): StatusChipTone {
  const s = status.toLowerCase();
  if (s.includes('open') || s.includes('pending')) return 'warn';
  if (s.includes('closed') || s.includes('resolved')) return 'neutral';
  if (s.includes('progress')) return 'sync';
  return 'neutral';
}

export function TicketDetailScreen({ route }: Props) {
  const { theme } = useTheme();
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

  if (!ticket) {
    return (
      <ScreenLayout testID="S-764">
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Loading…</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-764">
      <ExchangeCard elevated style={{ marginBottom: theme.spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})`, flex: 1 }]}>
            {ticket.subject}
          </Text>
          <StatusChip label={ticket.status} tone={ticketStatusTone(ticket.status)} />
        </View>
      </ExchangeCard>

      <FlatList
        data={ticket.messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingBottom: theme.spacing[3], gap: theme.spacing[2] }}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <ExchangeCard variant="terminal">
            <Text
              style={[
                theme.typography.labelSm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' },
              ]}
            >
              {item.sender_type}
            </Text>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: theme.spacing[1] }]}>
              {item.message}
            </Text>
          </ExchangeCard>
        )}
      />

      <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3], marginTop: theme.spacing[2] }}>
        <TextField label="Reply" value={reply} onChangeText={setReply} />
        <PrimaryButton title="Send reply" onPress={() => void send()} />
      </ExchangeCard>
    </ScreenLayout>
  );
}
