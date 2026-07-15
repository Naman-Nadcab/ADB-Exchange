import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SkeletonList, ErrorState, EmptyState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { merchantProfileFromAds } from '@core/domain/p2p/merchant';
import { useMerchantProfileAds, useBlockAdvertiser } from '../hooks/useP2P';
import { AdDetailMerchantCard } from '../components/AdDetailMerchantCard';
import { P2PAdCard } from '../components/P2PAdCard';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MerchantProfile'>;

export function MerchantProfileScreen({ route, navigation }: Props) {
  const { advertiserId, seedAd } = route.params;
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const q = useMerchantProfileAds(advertiserId, seedAd);
  const block = useBlockAdvertiser();

  useEffect(() => {
    analytics.screen('S-614');
  }, []);

  const ads = q.data ?? [];
  const profile = useMemo(() => merchantProfileFromAds(ads, advertiserId), [ads, advertiserId]);
  const isSelf = userId === advertiserId;

  if (q.isLoading && ads.length === 0) {
    return (
      <ScreenLayout testID="S-614">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (q.isError && ads.length === 0) {
    return (
      <ScreenLayout testID="S-614">
        <ErrorState title="Could not load merchant profile" onRetry={() => void q.refetch()} />
      </ScreenLayout>
    );
  }

  if (!profile) {
    return (
      <ScreenLayout testID="S-614">
        <EmptyState
          title="No active ads"
          message="This merchant has no active listings on the marketplace."
          actionLabel="Back to marketplace"
          onAction={() => navigation.navigate('Marketplace')}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-614">
      <FlatList
        data={ads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <AdDetailMerchantCard ad={profile.headAd} />
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Active Ads</Text>
            {isAuthenticated && !isSelf ? (
              <PrimaryButton
                title="Block advertiser"
                variant="secondary"
                loading={block.isPending}
                onPress={() => block.mutate(advertiserId)}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <P2PAdCard
            ad={item}
            fiat={item.fiat_currency}
            authed={isAuthenticated}
            onPress={() => navigation.navigate('AdDetail', { adId: item.id, ad: item })}
            onTrade={() => navigation.navigate('AdDetail', { adId: item.id, ad: item })}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  list: { paddingBottom: 24 },
});
