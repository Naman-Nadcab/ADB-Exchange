import { useEffect, useMemo, useState } from 'react';
import { FlatList, View, Text, Pressable, Switch, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SegmentControl, SkeletonList, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import {
  mergeAssets,
  filterAssets,
  computeAllocation,
  compute24hChange,
} from '@core/domain/wallet/portfolio';
import {
  usePortfolioSummary,
  useFundingBalances,
  useTradingBalances,
  usePortfolioHistory,
  usePnl,
} from '../hooks/useWallet';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AllocationChart } from '../components/AllocationChart';
import { BalanceBreakdown } from '../components/BalanceBreakdown';
import { AssetRow } from '../components/AssetRow';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AssetsHome'>;

export function AssetsHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const hideZero = useWalletPrefsStore((s) => s.hideZero);
  const hidden = useWalletPrefsStore((s) => s.hidden);
  const favorites = useWalletPrefsStore((s) => s.favorites);
  const sort = useWalletPrefsStore((s) => s.sort);
  const hydrate = useWalletPrefsStore((s) => s.hydrate);
  const setHideZero = useWalletPrefsStore((s) => s.setHideZero);
  const toggleFavorite = useWalletPrefsStore((s) => s.toggleFavorite);
  const setSort = useWalletPrefsStore((s) => s.setSort);

  const summaryQ = usePortfolioSummary();
  const fundingQ = useFundingBalances();
  const tradingQ = useTradingBalances();
  const historyQ = usePortfolioHistory('24h');
  const pnlQ = usePnl('7D');

  useEffect(() => {
    hydrate();
    analytics.screen('S-500');
  }, [hydrate]);

  const merged = useMemo(
    () => mergeAssets(fundingQ.data?.balances, tradingQ.data?.balances),
    [fundingQ.data, tradingQ.data],
  );

  const filtered = useMemo(
    () => filterAssets(merged, { search, hideZero, hidden, favorites, sort }),
    [merged, search, hideZero, hidden, favorites, sort],
  );

  const allocation = useMemo(() => computeAllocation(merged), [merged]);
  const change24h = compute24hChange(historyQ.data ?? []);

  const refreshing = summaryQ.isFetching || fundingQ.isFetching || tradingQ.isFetching;
  const onRefresh = () => {
    void summaryQ.refetch();
    void fundingQ.refetch();
    void tradingQ.refetch();
  };

  const isLoading = summaryQ.isLoading && !summaryQ.data;

  return (
    <ScreenLayout testID="S-500">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.symbol}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {isLoading ? (
              <SkeletonList rows={4} />
            ) : (
              <>
                <PortfolioSummary
                  totalUsd={summaryQ.data?.total.totalUsd ?? '0'}
                  change24h={change24h}
                  pnlToday={pnlQ.data?.totalPnl ?? null}
                  fundingUsd={summaryQ.data?.funding.totalUsd}
                  tradingUsd={summaryQ.data?.trading.totalUsd}
                />
                <AllocationChart slices={allocation} />
                {fundingQ.data ? (
                  <BalanceBreakdown
                    availableUsd={fundingQ.data.availableBalance.usd}
                    lockedUsd={fundingQ.data.inUse.usd}
                    availableBtc={fundingQ.data.availableBalance.btc}
                    lockedBtc={fundingQ.data.inUse.btc}
                  />
                ) : null}
                <View style={styles.actions}>
                  <PrimaryButton title="Transfer" variant="secondary" onPress={() => navigation.navigate('Transfer')} />
                  <PrimaryButton title="Convert" variant="secondary" onPress={() => navigation.navigate('Convert')} />
                  <PrimaryButton title="Deposit" variant="secondary" onPress={() => navigation.navigate('DepositHome')} />
                  <PrimaryButton title="Withdraw" variant="secondary" onPress={() => navigation.navigate('WithdrawHome')} />
                </View>
                <View style={styles.links}>
                  <Pressable onPress={() => navigation.navigate('TransferHistory')}>
                    <Text style={[styles.link, { color: `hsl(${theme.colors.brandPrimary})` }]}>Transfers</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('ConvertHistory')}>
                    <Text style={[styles.link, { color: `hsl(${theme.colors.brandPrimary})` }]}>Converts</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('TransactionHistory')}>
                    <Text style={[styles.link, { color: `hsl(${theme.colors.brandPrimary})` }]}>Ledger</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('FundHistory')}>
                    <Text style={[styles.link, { color: `hsl(${theme.colors.brandPrimary})` }]}>Funds</Text>
                  </Pressable>
                </View>
                <SearchBar value={search} onChangeText={setSearch} placeholder="Search assets" />
                <SegmentControl
                  tabs={[
                    { id: 'value', label: 'Value' },
                    { id: 'name', label: 'Name' },
                    { id: 'symbol', label: 'Symbol' },
                  ]}
                  active={sort}
                  onChange={(id) => setSort(id as 'value' | 'name' | 'symbol')}
                />
                <View style={styles.toggleRow}>
                  <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Hide zero balances</Text>
                  <Switch value={hideZero} onValueChange={setHideZero} />
                </View>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <AssetRow
            asset={item}
            isFavorite={favorites.has(item.symbol)}
            onPress={() => navigation.navigate('AssetDetail', { symbol: item.symbol })}
            onToggleFavorite={() => toggleFavorite(item.symbol)}
          />
        )}
        initialNumToRender={15}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          !isLoading ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center', marginTop: 24 }}>
              No assets match your filters
            </Text>
          ) : null
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
  link: { fontWeight: '600', fontSize: 13 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
});
