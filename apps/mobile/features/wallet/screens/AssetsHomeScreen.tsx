import { useEffect, useMemo, useState } from 'react';
import { FlatList, View, Text, Pressable, Switch, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, SearchBar, SegmentControl, SkeletonList, ExchangeCard, AccountEntryButton } from '@shared/ui';
import { GuestAuthPrompt, useGuestAccess } from '@features/auth';
import { useTheme, hapticLight } from '@shared/theme';
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
                <Text style={[styles.heroTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Wallet</Text>
                <Text style={[styles.heroSub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                  Portfolio · Funding · Trading
                </Text>
              </View>
              <AccountEntryButton />
            </View>

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

                <ExchangeCard variant="terminal" style={styles.historyCard}>
                  <Pressable onPress={() => navigation.navigate('TransactionHistory')} style={styles.historyLink}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>Ledger History</Text>
                    <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('TransferHistory')} style={[styles.historyLink, styles.historyBorder, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>Transfers</Text>
                    <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('ConvertHistory')} style={[styles.historyLink, styles.historyBorder, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>Converts</Text>
                    <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('FundHistory')} style={[styles.historyLink, styles.historyBorder, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>Funds</Text>
                    <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
                  </Pressable>
                </ExchangeCard>

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
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
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
  historyCard: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  historyLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  historyBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
});
