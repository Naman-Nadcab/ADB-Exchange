import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useNotifications, useNotificationMutations } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

type Props = NativeStackScreenProps<AccountStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
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
      <SegmentControl tabs={TABS} active={tab} onChange={setTab} />
      <PrimaryButton title="Mark all read" variant="secondary" onPress={() => markAllRead.mutate()} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        initialNumToRender={20}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 12 }} onPress={() => navigation.navigate('NotificationDetail', { id: item.id })}>
            <Text style={{ fontWeight: item.read ? '400' : '700' }}>{item.title}</Text>
            <Text style={{ fontSize: 12 }}>{item.type} · {new Date(item.created_at).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
