import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncements } from '@features/markets';
import {
  ScreenLayout,
  SkeletonList,
  ErrorState,
  EmptyState,
  ErrorBanner,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { AnnouncementListRow } from '../components/AnnouncementListRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Announcements'>;

export function AnnouncementsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useAnnouncements(50);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    analytics.screen('S-770');
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  }, [q]);

  const listHeader = (
    <View style={styles.header}>
      <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
        <Ionicons name="notifications-outline" size={22} color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Announcements</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
          Latest updates and news from the platform
        </Text>
      </View>
      <Pressable onPress={() => void onRefresh()} hitSlop={10} accessibilityLabel="Refresh announcements">
        <Ionicons name="refresh" size={22} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </Pressable>
    </View>
  );

  return (
    <ScreenLayout testID="S-770">
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached announcements where available" onRetry={() => void onRefresh()} />
      ) : null}

      {q.isLoading && !q.data ? (
        <View style={styles.body}>
          {listHeader}
          <SkeletonList rows={6} />
        </View>
      ) : q.isError && !q.data ? (
        <View style={styles.body}>
          {listHeader}
          <ErrorState title="Could not load announcements" onRetry={() => void q.refetch()} />
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.body}
          renderItem={({ item }) => (
            <AnnouncementListRow
              item={item}
              onPress={() => navigation.navigate('AnnouncementDetail', { id: item.id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No announcements"
              message="There are no announcements at the moment. Check back later for updates."
            />
          }
        />
      )}

      {q.isError && q.data ? (
        <ErrorBanner message="Refresh failed — showing cached announcements" onRetry={() => void q.refetch()} />
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
});
