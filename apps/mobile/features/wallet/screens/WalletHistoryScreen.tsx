import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View, Text, StyleSheet } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, ErrorBanner, ErrorState, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useFundingBalances } from '../hooks/useWallet';
import {
  useFilteredWalletHistory,
  useWalletHistoryFilters,
} from '../hooks/useWalletHistory';
import { WalletHistoryFiltersBar } from '../components/WalletHistoryFilters';
import { WalletHistoryRow } from '../components/WalletHistoryRow';
import type { WalletHistoryTab, WalletHistoryDetailTarget } from '@core/domain/wallet/walletHistory';
import type { WalletStackParamList } from '../navigation/types';

export type WalletHistoryScreenProps = {
  navigation: Pick<NativeStackNavigationProp<WalletStackParamList>, 'navigate'>;
  route: { params?: { tab?: string; coin?: string } };
  initialTab?: WalletHistoryTab;
};

export function WalletHistoryScreen({ navigation, route, initialTab }: WalletHistoryScreenProps) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const routeTab = route.params?.tab as WalletHistoryTab | undefined;
  const routeCoin = route.params?.coin;
  const [tab, setTab] = useState<WalletHistoryTab>(routeTab ?? initialTab ?? 'all');

  const { filters, patchFilters, resetFilters } = useWalletHistoryFilters({
    asset: routeCoin?.toUpperCase() ?? '',
  });

  useEffect(() => {
    analytics.screen('S-552');
  }, []);

  useEffect(() => {
    if (routeTab) setTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    if (routeCoin) patchFilters({ asset: routeCoin.toUpperCase() });
  }, [routeCoin, patchFilters]);

  const serverFilters = useMemo(
    () => ({
      coin: filters.asset || undefined,
      status: filters.status || undefined,
    }),
    [filters.asset, filters.status],
  );

  const q = useFilteredWalletHistory(tab, filters, serverFilters);
  const balancesQ = useFundingBalances();

  const assetOptions = useMemo(() => {
    const symbols = balancesQ.data?.balances.map((b) => b.symbol.toUpperCase()) ?? [];
    return ['', ...Array.from(new Set(symbols)).sort()];
  }, [balancesQ.data]);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  const navigateDetail = useCallback(
    (target?: WalletHistoryDetailTarget) => {
      if (!target) return;
      switch (target.screen) {
        case 'DepositDetail':
          navigation.navigate('DepositDetail', target.params);
          break;
        case 'WithdrawalDetail':
          navigation.navigate('WithdrawalDetail', target.params);
          break;
        case 'TransferDetail':
          navigation.navigate('TransferDetail', target.params);
          break;
        case 'ConvertDetail':
          navigation.navigate('ConvertDetail', target.params);
          break;
      }
    },
    [navigation],
  );

  const onTabChange = useCallback((next: WalletHistoryTab) => {
    setTab(next);
  }, []);

  const listHeader = (
    <WalletHistoryFiltersBar
      tab={tab}
      onTabChange={onTabChange}
      filters={filters}
      onFiltersChange={patchFilters}
      onReset={resetFilters}
      assetOptions={assetOptions}
    />
  );

  return (
    <ScreenLayout testID="S-552">
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Wallet history</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
          Deposits, withdrawals, transfers, and conversions in one place.
        </Text>
      </View>

      {!isOnline ? <ErrorBanner message="Offline — history may be stale" onRetry={onRefresh} /> : null}

      {q.isLoading && !q.data ? (
        <>
          {listHeader}
          <SkeletonList rows={10} />
        </>
      ) : q.isError ? (
        <>
          {listHeader}
          <ErrorState title="Could not load wallet history" onRetry={onRefresh} />
        </>
      ) : (
        <FlatList
          data={q.rows}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <WalletHistoryRow row={item} onPress={item.detail ? () => navigateDetail(item.detail) : undefined} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No history yet"
              message="Your wallet activity will appear here once you deposit, withdraw, transfer, or convert."
            />
          }
          ListFooterComponent={q.isFetchingNextPage ? <SkeletonList rows={2} /> : null}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '700' },
});
