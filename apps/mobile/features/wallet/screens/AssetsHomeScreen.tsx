import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, View, Text, Pressable, Switch, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SegmentControl,
  SkeletonList,
  ErrorBanner,
  EmptyState,
  ErrorState,
} from '@shared/ui';
import { GuestAuthPrompt, useGuestAccess } from '@features/auth';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import {
  mergeAssets,
  filterAssets,
  computeAllocation,
  computePeriodPnl,
} from '@core/domain/wallet/portfolio';
import {
  usePortfolioSummary,
  useFundingBalances,
  useTradingBalances,
  usePortfolioHistory,
  useRecentTransactions,
  useFiatBalance,
  type PortfolioHistoryPeriod,
} from '../hooks/useWallet';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AllocationChart } from '../components/AllocationChart';
import { FiatBalanceCard } from '../components/FiatBalanceCard';
import { RecentTransactionsList } from '../components/RecentTransactionsList';
import { mapFromWalletRecentTransaction } from '@core/domain/wallet/walletHistory';
import type { WalletRecentTransaction } from '@exchange/mobile-types';
import { AssetRow } from '../components/AssetRow';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AssetsHome'>;

const QUICK_ACTIONS = [
  { id: 'deposit', label: 'Deposit', icon: 'arrow-down-circle' as const, primary: true },
  { id: 'withdraw', label: 'Withdraw', icon: 'arrow-up-circle' as const },
  { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal' as const },
  { id: 'convert', label: 'Convert', icon: 'repeat' as const },
];

export function AssetsHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isGuest, requireAuth } = useGuestAccess();
  const isOnline = useAppStore((s) => s.isOnline);
  const [search, setSearch] = useState('');
  const [chartPeriod, setChartPeriod] = useState<PortfolioHistoryPeriod>('24h');

  const hideZero = useWalletPrefsStore((s) => s.hideZero);
  const showBalances = useWalletPrefsStore((s) => s.showBalances);
  const hidden = useWalletPrefsStore((s) => s.hidden);
  const favorites = useWalletPrefsStore((s) => s.favorites);
  const sort = useWalletPrefsStore((s) => s.sort);
  const hydrate = useWalletPrefsStore((s) => s.hydrate);
  const setHideZero = useWalletPrefsStore((s) => s.setHideZero);
  const toggleShowBalances = useWalletPrefsStore((s) => s.toggleShowBalances);
  const toggleFavorite = useWalletPrefsStore((s) => s.toggleFavorite);
  const setSort = useWalletPrefsStore((s) => s.setSort);

  const summaryQ = usePortfolioSummary();
  const fundingQ = useFundingBalances();
  const tradingQ = useTradingBalances();
  const historyQ = usePortfolioHistory(chartPeriod);
  const recentTxQ = useRecentTransactions(8);
  const fiatBalanceQ = useFiatBalance(!isGuest);

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
  const periodPnl = computePeriodPnl(historyQ.data ?? []);

  const balanceError =
    summaryQ.isError || fundingQ.isError || tradingQ.isError
      ? 'Balances could not be loaded. Pull to refresh or tap retry.'
      : null;

  const refreshing =
    summaryQ.isFetching ||
    fundingQ.isFetching ||
    tradingQ.isFetching ||
    historyQ.isFetching ||
    fiatBalanceQ.isFetching;

  const onRefresh = useCallback(() => {
    void summaryQ.refetch();
    void fundingQ.refetch();
    void tradingQ.refetch();
    void historyQ.refetch();
    void recentTxQ.refetch();
    void fiatBalanceQ.refetch();
  }, [summaryQ, fundingQ, tradingQ, historyQ, recentTxQ, fiatBalanceQ]);

  const onRetryBalances = useCallback(() => {
    void summaryQ.refetch();
    void fundingQ.refetch();
    void tradingQ.refetch();
  }, [summaryQ, fundingQ, tradingQ]);

  const onRecentSelect = useCallback(
    (tx: WalletRecentTransaction) => {
      const row = mapFromWalletRecentTransaction(tx);
      if (!row.detail) return;
      switch (row.detail.screen) {
        case 'DepositDetail':
          navigation.navigate('DepositDetail', row.detail.params);
          break;
        case 'WithdrawalDetail':
          navigation.navigate('WithdrawalDetail', row.detail.params);
          break;
        case 'TransferDetail':
          navigation.navigate('TransferDetail', row.detail.params);
          break;
        case 'ConvertDetail':
          navigation.navigate('ConvertDetail', row.detail.params);
          break;
      }
    },
    [navigation],
  );

  const isLoading = (summaryQ.isLoading || fundingQ.isLoading) && !summaryQ.data && !fundingQ.data;

  const onQuickAction = (id: string) => {
    void hapticLight();
    if (!requireAuth()) return;
    switch (id) {
      case 'deposit':
        navigation.navigate('DepositHome');
        break;
      case 'withdraw':
        navigation.navigate('WithdrawHome');
        break;
      case 'transfer':
        navigation.navigate('Transfer');
        break;
      case 'convert':
        navigation.navigate('Convert');
        break;
    }
  };

  const onAssetDeposit = (symbol: string, name: string) => {
    if (!requireAuth()) return;
    navigation.navigate('DepositNetwork', { symbol, name });
  };

  const onAssetWithdraw = (symbol: string, name: string) => {
    if (!requireAuth()) return;
    navigation.navigate('WithdrawNetwork', { symbol, name });
  };

  const onAssetTrade = (symbol: string) => {
    navigation.getParent()?.navigate('Trade', {
      screen: 'SpotTrading',
      params: { symbol: `${symbol}_USDT` },
    });
  };

  return (
    <ScreenLayout testID="S-500">
      {isGuest ? (
        <GuestAuthPrompt
          testID="S-500-guest"
          title="Login to view your assets"
          message="Sign in to see balances, deposit, withdraw, and manage your portfolio."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.symbol}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                    Assets Overview
                  </Text>
                  <Text style={[styles.heroSub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                    Portfolio · Funding · Trading
                  </Text>
                </View>
                <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh wallet">
                  <Ionicons
                    name="refresh"
                    size={22}
                    color={`hsl(${theme.colors.foregroundSecondary})`}
                  />
                </Pressable>
              </View>

              {!isOnline ? (
                <ErrorBanner message="Offline — showing cached balances where available" onRetry={onRefresh} />
              ) : null}

              {balanceError ? (
                <ErrorBanner message={balanceError} onRetry={onRetryBalances} />
              ) : null}

              {isLoading ? (
                <SkeletonList rows={6} />
              ) : summaryQ.isError && !summaryQ.data ? (
                <ErrorState title="Could not load wallet" onRetry={onRetryBalances} />
              ) : (
                <>
                  <PortfolioSummary
                    totalUsd={summaryQ.data?.total.totalUsd ?? '0'}
                    totalBtc={summaryQ.data?.total.totalBtc}
                    periodPnl={periodPnl}
                    chartPeriod={chartPeriod}
                    chartData={historyQ.data ?? []}
                    chartError={
                      historyQ.isError ? 'Portfolio chart unavailable.' : null
                    }
                    onChartRetry={() => void historyQ.refetch()}
                    onChartPeriodChange={setChartPeriod}
                    fundingUsd={summaryQ.data?.funding.totalUsd}
                    tradingUsd={summaryQ.data?.trading.totalUsd}
                    showBalances={showBalances}
                    onToggleShowBalances={() => {
                      void hapticLight();
                      toggleShowBalances();
                    }}
                  />
                  <AllocationChart
                    slices={allocation}
                    totalUsd={summaryQ.data?.total.totalUsd}
                    showBalances={showBalances}
                  />

                  <FiatBalanceCard
                    availableBalance={fiatBalanceQ.data?.available_balance ?? '0'}
                    isLoading={fiatBalanceQ.isLoading}
                    isError={fiatBalanceQ.isError}
                    showBalances={showBalances}
                    onRetry={() => void fiatBalanceQ.refetch()}
                    onWithdrawInr={() => {
                      if (!requireAuth()) return;
                      navigation.navigate('FiatWithdraw');
                    }}
                    onManageBanks={() => {
                      if (!requireAuth()) return;
                      navigation.getParent()?.navigate('P2P', { screen: 'PaymentMethods' });
                    }}
                  />

                  <View style={styles.actions}>
                    {QUICK_ACTIONS.map((action) => (
                      <Pressable
                        key={action.id}
                        onPress={() => onQuickAction(action.id)}
                        style={[
                          styles.actionBtn,
                          action.primary
                            ? { backgroundColor: `hsl(${theme.colors.brandPrimary})` }
                            : {
                                backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
                                borderColor: `hsl(${theme.colors.borderDefault})`,
                                borderWidth: 1,
                              },
                        ]}
                      >
                        <Ionicons
                          name={action.icon}
                          size={18}
                          color={
                            action.primary
                              ? `hsl(${theme.colors.brandPrimaryForeground})`
                              : `hsl(${theme.colors.foregroundPrimary})`
                          }
                        />
                        <Text
                          style={{
                            color: action.primary
                              ? `hsl(${theme.colors.brandPrimaryForeground})`
                              : `hsl(${theme.colors.foregroundPrimary})`,
                            fontWeight: '700',
                            fontSize: 12,
                          }}
                        >
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <RecentTransactionsList
                    items={recentTxQ.data?.items ?? []}
                    isLoading={recentTxQ.isLoading}
                    error={
                      recentTxQ.isError ? 'Recent activity is temporarily unavailable.' : null
                    }
                    onRetry={() => void recentTxQ.refetch()}
                    onViewAll={() => navigation.navigate('WalletHistory', { tab: 'all' })}
                    onSelect={onRecentSelect}
                  />

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
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
                      Hide zero balances
                    </Text>
                    <Switch value={hideZero} onValueChange={setHideZero} />
                  </View>
                  {filtered.length === 0 && merged.length === 0 && !search.trim() ? (
                    <EmptyState
                      title="No assets yet"
                      message="Deposit crypto to start building your portfolio."
                    />
                  ) : null}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <AssetRow
              asset={item}
              isFavorite={favorites.has(item.symbol)}
              showBalances={showBalances}
              onPress={() => navigation.navigate('AssetDetail', { symbol: item.symbol })}
              onToggleFavorite={() => toggleFavorite(item.symbol)}
              onDeposit={() => onAssetDeposit(item.symbol, item.name)}
              onWithdraw={() => onAssetWithdraw(item.symbol, item.name)}
              onTrade={() => onAssetTrade(item.symbol)}
            />
          )}
          initialNumToRender={15}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            !isLoading && merged.length > 0 ? (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center', marginTop: 24 }}>
                No assets match your filters
              </Text>
            ) : null
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  heroSub: { fontSize: 13, marginBottom: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
});
