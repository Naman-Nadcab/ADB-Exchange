import { useEffect, useMemo } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useNotifications, useNotificationMutations } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'NotificationDetail'>;

export function NotificationDetailScreen({ route }: Props) {
  const q = useNotifications();
  const { markRead } = useNotificationMutations();
  const item = useMemo(() => q.data?.find((n) => n.id === route.params.id), [q.data, route.params.id]);

  useEffect(() => {
    analytics.screen('S-773');
    if (item && !item.read) markRead.mutate(item.id);
  }, [item, markRead]);

  if (!item) return <ScreenLayout><Text>Not found</Text></ScreenLayout>;

  return (
    <ScreenLayout testID="S-773">
      <ScrollView>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>{item.title}</Text>
        <Text style={{ marginVertical: 8 }}>{item.body ?? ''}</Text>
        <Text style={{ fontSize: 12 }}>{item.type} · {new Date(item.created_at).toLocaleString()}</Text>
      </ScrollView>
    </ScreenLayout>
  );
}
