import { useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useSupportTickets } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SupportTickets'>;

function ticketStatusTone(status: string): StatusChipTone {
  const s = status.toLowerCase();
  if (s.includes('open') || s.includes('pending')) return 'warn';
  if (s.includes('closed') || s.includes('resolved')) return 'neutral';
  if (s.includes('progress')) return 'sync';
  return 'neutral';
}

export function SupportTicketsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useSupportTickets();

  useEffect(() => {
    analytics.screen('S-762');
  }, []);

  return (
    <ScreenLayout testID="S-762">
      <View style={{ marginBottom: theme.spacing[3] }}>
        <PrimaryButton title="Create ticket" onPress={() => navigation.navigate('CreateTicket')} />
      </View>

      {q.isLoading && !q.data ? (
        <SkeletonList rows={4} />
      ) : q.isError && !q.data ? (
        <ErrorState title="Could not load tickets" onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No support tickets"
              message="Create a ticket if you need help from our support team."
            />
          }
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[2] }}>
              <Pressable onPress={() => navigation.navigate('TicketDetail', { id: item.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, flex: 1 },
                    ]}
                  >
                    {item.subject}
                  </Text>
                  <StatusChip label={item.status} tone={ticketStatusTone(item.status)} />
                </View>
              </Pressable>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
