import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[4],
      }}
    >
      <View
        style={{
          width: theme.sizes.buttonMd,
          height: theme.sizes.buttonMd,
          borderRadius: theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
        }}
      >
        <Ionicons name="notifications-outline" size={theme.sizes.iconSm + 2} color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Announcements</Text>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Latest updates and news from the platform
        </Text>
      </View>
      <Pressable onPress={() => void onRefresh()} hitSlop={theme.spacing[2.5]} accessibilityLabel="Refresh announcements">
        <Ionicons name="refresh" size={theme.sizes.iconSm + 2} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </Pressable>
    </View>
  );

  return (
    <ScreenLayout testID="S-770">
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached announcements where available" onRetry={() => void onRefresh()} />
      ) : null}

      {q.isLoading && !q.data ? (
        <View style={{ padding: theme.spacing[4], paddingBottom: theme.spacing[8] }}>
          {listHeader}
          <SkeletonList rows={6} />
        </View>
      ) : q.isError && !q.data ? (
        <View style={{ padding: theme.spacing[4], paddingBottom: theme.spacing[8] }}>
          {listHeader}
          <ErrorState title="Could not load announcements" onRetry={() => void q.refetch()} />
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ padding: theme.spacing[4], paddingBottom: theme.spacing[8] }}
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
