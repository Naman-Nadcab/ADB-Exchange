import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncement } from '@features/markets';
import {
  ScreenLayout,
  SkeletonList,
  ErrorState,
  ErrorBanner,
  ExchangeCard,
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
        <Text
          style={[
            theme.typography.bodyMd,
            { color: `hsl(${theme.colors.foregroundSecondary})`, padding: theme.spacing[4] },
          ]}
        >
          Announcement not found or no longer available.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Announcements')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], paddingHorizontal: theme.spacing[4] }}
        >
          <Ionicons name="arrow-back" size={theme.sizes.iconXs} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Back to announcements
          </Text>
        </Pressable>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-771">
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached announcement where available" onRetry={() => void q.refetch()} />
      ) : null}

      <ScrollView contentContainerStyle={{ padding: theme.spacing[4], paddingBottom: theme.spacing[8] }}>
        <Pressable
          onPress={() => navigation.navigate('Announcements')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}
        >
          <Ionicons name="arrow-back" size={theme.sizes.iconXs} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Back to announcements
          </Text>
        </Pressable>

        <ExchangeCard>
          <View
            style={{
              paddingBottom: theme.spacing[5],
              marginBottom: theme.spacing[4],
              borderBottomWidth: 1,
              borderBottomColor: `hsl(${theme.colors.borderDefault})`,
            }}
          >
            <AnnouncementMetaBadges type={item.type} pinned={item.is_pinned} />
            <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{item.title}</Text>
            <Text
              style={[
                theme.typography.bodyMd,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[2] },
              ]}
            >
              {formatAnnouncementDetailDate(item)}
            </Text>
          </View>

          <View>
            {item.summary ? (
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[3] },
                ]}
              >
                {item.summary}
              </Text>
            ) : null}
            {item.body ? (
              <AnnouncementHtmlBody html={item.body} />
            ) : (
              <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                No additional content.
              </Text>
            )}
          </View>
        </ExchangeCard>
      </ScrollView>

      {q.isError && item ? (
        <ErrorBanner message="Refresh failed — showing cached announcement" onRetry={() => void q.refetch()} />
      ) : null}
    </ScreenLayout>
  );
}
