import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import {
  resolveAnnouncementNotificationRoute,
  resolveNotificationRoute,
  resolveP2PNotificationRoute,
} from '@core/domain/notifications/routing';
import { useNotifications, useNotificationMutations } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'NotificationDetail'>;

export function NotificationDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const q = useNotifications();
  const { markRead } = useNotificationMutations();
  const item = q.data?.find((n) => n.id === route.params.id);

  useEffect(() => {
    analytics.screen('S-773');
    if (item && !item.read) markRead.mutate(item.id);
  }, [item, markRead]);

  const p2pRoute = item ? resolveP2PNotificationRoute(item) : null;
  const announcementRoute = item ? resolveAnnouncementNotificationRoute(item) : null;
  const routeHint = item ? resolveNotificationRoute(item) : null;

  const openP2POrder = () => {
    if (!p2pRoute) return;
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'P2P',
          params: { screen: 'OrderRoom', params: { orderId: p2pRoute.orderId } },
        },
      }),
    );
  };

  const openAnnouncementDetail = () => {
    if (!announcementRoute) return;
    navigation.navigate('AnnouncementDetail', { id: announcementRoute.announcementId });
  };

  const openAnnouncementsHub = () => {
    navigation.navigate('Announcements');
  };

  if (!item) {
    return (
      <ScreenLayout>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Not found</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-773">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <ExchangeCard elevated>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
            <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})`, flex: 1 }]}>
              {item.title}
            </Text>
            {!item.read ? <StatusChip label="Unread" tone="sync" /> : null}
          </View>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[2] },
            ]}
          >
            {item.type} · {new Date(item.created_at).toLocaleString()}
          </Text>
        </ExchangeCard>

        <ExchangeCard variant="terminal">
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {item.body ?? ''}
          </Text>
        </ExchangeCard>

        {p2pRoute ? <PrimaryButton title="View P2P order" onPress={openP2POrder} /> : null}
        {announcementRoute ? <PrimaryButton title="View announcement" onPress={openAnnouncementDetail} /> : null}
        {routeHint?.kind === 'announcements_hub' ? (
          <PrimaryButton title="View announcements" onPress={openAnnouncementsHub} />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}
