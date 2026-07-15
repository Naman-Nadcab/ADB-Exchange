import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncement } from '@features/markets';
import {
  ScreenLayout,
  SkeletonList,
  ErrorState,
  ErrorBanner,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { formatAnnouncementDetailDate } from '@core/domain/announcements/announcements';
import { AnnouncementMetaBadges } from '../components/AnnouncementMetaBadges';
import { AnnouncementHtmlBody } from '../components/AnnouncementHtmlBody';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AnnouncementDetail'>;

export function AnnouncementDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const { id } = route.params;
  const q = useAnnouncement(id);

  useEffect(() => {
    analytics.screen('S-771');
  }, []);

  const item = q.data;

  if (q.isLoading && !item) {
    return (
      <ScreenLayout testID="S-771">
        <SkeletonList rows={8} />
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-771">
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, padding: 16 }}>
          Announcement not found or no longer available.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Announcements')}
          style={styles.backLink}
        >
          <Ionicons name="arrow-back" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Back to announcements</Text>
        </Pressable>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-771">
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached announcement where available" onRetry={() => void q.refetch()} />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.navigate('Announcements')} style={styles.backLink}>
          <Ionicons name="arrow-back" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 14 }}>Back to announcements</Text>
        </Pressable>

        <View
          style={[
            styles.card,
            {
              borderColor: `hsl(${theme.colors.borderDefault})`,
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
            },
          ]}
        >
          <View style={[styles.cardHeader, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <AnnouncementMetaBadges type={item.type} pinned={item.is_pinned} />
            <Text style={[styles.heading, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{item.title}</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 8 }}>
              {formatAnnouncementDetailDate(item)}
            </Text>
          </View>

          <View style={styles.cardBody}>
            {item.summary ? (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>{item.summary}</Text>
            ) : null}
            {item.body ? (
              <AnnouncementHtmlBody html={item.body} />
            ) : (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>No additional content.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {q.isError && item ? (
        <ErrorBanner message="Refresh failed — showing cached announcement" onRetry={() => void q.refetch()} />
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  cardHeader: { padding: 20, borderBottomWidth: 1 },
  cardBody: { padding: 20 },
  heading: { fontSize: 20, fontWeight: '700' },
});
