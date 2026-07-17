import { useEffect, useMemo } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorState, EmptyState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { analytics } from '@core/observability/analytics';
import {
  buildDashboardStatCards,
  computeCompletedFiatVolume,
  countAdsByStatus,
  isVerifiedMerchant,
} from '@core/domain/p2p/merchant';
import { useMerchantDashboard } from '../hooks/useP2P';
import {
  MerchantAdBreakdown,
  MerchantDashboardHeader,
  MerchantQuickLink,
  MerchantStatGrid,
  MerchantVolumePanel,
} from '../components/MerchantDashboardSections';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MerchantDashboard'>;

export function MerchantDashboardScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const { statsQ, ordersQ, adsQ } = useMerchantDashboard();

  useEffect(() => {
    analytics.screen('S-613');
  }, []);

  const loading = statsQ.isLoading && !statsQ.data;
  const error = statsQ.isError && !statsQ.data;

  const statCards = useMemo(
    () => buildDashboardStatCards(statsQ.data, ordersQ.data ?? []),
    [statsQ.data, ordersQ.data],
  );
  const volume = useMemo(() => computeCompletedFiatVolume(ordersQ.data ?? []), [ordersQ.data]);
  const adCounts = useMemo(() => countAdsByStatus(adsQ.data ?? []), [adsQ.data]);
  const verified = isVerifiedMerchant(statsQ.data);

  const onRefresh = () => {
    void statsQ.refetch();
    void ordersQ.refetch();
    void adsQ.refetch();
  };

  if (loading) {
    return (
      <ScreenLayout testID="S-613">
        <SkeletonList rows={8} />
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout testID="S-613">
        <ErrorState title="Could not load merchant dashboard" onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  if (!statsQ.data) {
    return (
      <ScreenLayout testID="S-613">
        <EmptyState
          title="No merchant stats yet"
          message="Complete P2P trades to build your merchant profile."
          actionLabel="Browse marketplace"
          onAction={() => navigation.navigate('Marketplace')}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-613">
      {!isOnline ? (
        <View
          style={[
            styles.offline,
            {
              backgroundColor: `hsl(${theme.colors.statusError} / 0.08)`,
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              marginBottom: theme.spacing[2],
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.statusError})` }]}>
            Offline — showing cached data.
          </Text>
        </View>
      ) : null}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={statsQ.isFetching || ordersQ.isFetching || adsQ.isFetching} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.content}
      >
        <MerchantDashboardHeader verified={verified} />
        <MerchantStatGrid stats={statCards} verified={verified} />
        <MerchantVolumePanel volume={volume} />
        <MerchantAdBreakdown {...adCounts} />
        <MerchantQuickLink
          title="Manage ads"
          subtitle="Edit, pause, or create listings"
          icon="megaphone-outline"
          onPress={() => navigation.navigate('MyAds')}
        />
        <MerchantQuickLink
          title="View orders"
          subtitle="Track every P2P transaction"
          icon="list-outline"
          onPress={() => navigation.navigate('OrdersList')}
        />
        <MerchantQuickLink
          title="Payment methods"
          subtitle="Accounts buyers pay into"
          icon="card-outline"
          onPress={() => navigation.navigate('PaymentMethods')}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  offline: { borderRadius: 8, padding: 10, marginBottom: 8 },
});
