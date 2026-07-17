import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, PrimaryButton, ExchangeCard, StatusChip, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useNotifications, useNotificationMutations } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

type Props = NativeStackScreenProps<AccountStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('all');
  const q = useNotifications();
  const { markAllRead } = useNotificationMutations();

  useEffect(() => {
    analytics.screen('S-772');
  }, []);

  const items = useMemo(() => {
    const all = q.data ?? [];
    return tab === 'unread' ? all.filter((n) => !n.read) : all;
  }, [q.data, tab]);

  return (
    <ScreenLayout testID="S-772">
      <View style={{ gap: theme.spacing[3], marginBottom: theme.spacing[3] }}>
        <SegmentControl tabs={TABS} active={tab} onChange={setTab} />
        <PrimaryButton title="Mark all read" variant="secondary" onPress={() => markAllRead.mutate()} />
      </View>

      {q.isLoading && !q.data ? (
        <SkeletonList rows={8} />
      ) : q.isError && !q.data ? (
        <ErrorState title="Could not load notifications" onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          ListFooterComponent={
            <Pressable
              onPress={() => navigation.navigate('Announcements')}
              style={{ paddingVertical: theme.spacing[4], alignItems: 'center' }}
            >
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                ]}
              >
                View all announcements
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              message={tab === 'unread' ? 'You have no unread notifications.' : 'Your inbox is empty.'}
            />
          }
          renderItem={({ item }) => (
            <ExchangeCard
              variant="terminal"
              style={{ marginBottom: theme.spacing[2] }}
              testID={`notification-${item.id}`}
            >
              <Pressable onPress={() => navigation.navigate('NotificationDetail', { id: item.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      {
                        color: `hsl(${theme.colors.foregroundPrimary})`,
                        fontFamily: item.read ? theme.fonts.sans : theme.fonts.sansBold,
                        flex: 1,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {!item.read ? <StatusChip label="Unread" tone="sync" /> : null}
                </View>
                <Text
                  style={[
                    theme.typography.bodySm,
                    { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                  ]}
                >
                  {item.type} · {new Date(item.created_at).toLocaleString()}
                </Text>
              </Pressable>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
