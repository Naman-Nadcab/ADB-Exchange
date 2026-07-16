import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SkeletonList,
  ErrorBanner,
  EmptyState,
  ErrorState,
  PrimaryButton,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import { filterTradingBalances } from '@core/domain/wallet/portfolio';
import { useTradingBalances } from '../hooks/useWallet';
import { TradingEquitySummary } from '../components/TradingEquitySummary';
import { TradingBalanceRow } from '../components/TradingBalanceRow';
import type { WalletStackParamList } from '../navigation/types';
import type { TradingBalance } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<WalletStackParamList, 'TradingAccount'>;

export function TradingAccountScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const tradingQ = useTradingBalances();

  const hideSmall = useWalletPrefsStore((s) => s.hideSmall);
  const showBalances = useWalletPrefsStore((s) => s.showBalances);
  const hydrate = useWalletPrefsStore((s) => s.hydrate);
  const setHideSmall = useWalletPrefsStore((s) => s.setHideSmall);
  const toggleShowBalances = useWalletPrefsStore((s) => s.toggleShowBalances);

  const [search, setSearch] = useState('');

  useEffect(() => {
    hydrate();
    analytics.screen('S-503');
  }, [hydrate]);

  const filtered = useMemo(() => {
    return filterTradingBalances(tradingQ.data?.balances ?? [], { search, hideSmall });
  }, [tradingQ.data?.balances, search, hideSmall]);

  const onRefresh = useCallback(() => {
    void tradingQ.refetch();
  }, [tradingQ]);

  const onTrade = () => {
    navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading' });
  };

  const isLoading = tradingQ.isLoading && !tradingQ.data;
  const emptyMessage =
    search.trim().length > 0
      ? 'Try a different search term or clear filters.'
      : hideSmall && (tradingQ.data?.balances.length ?? 0) > 0
        ? 'All rows are hidden while hide small balances is on. Turn it off to see every asset.'
        : 'Transfer funds to start trading.';

  const renderRow = ({ item }: { item: TradingBalance }) => (
    <TradingBalanceRow balance={item} showBalances={showBalances} onTrade={onTrade} />
  );

  const listHeader = (
    <View>
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              Unified Trading
            </Text>
            <Pressable
              onPress={() => {
                void hapticLight();
                toggleShowBalances();
              }}
              hitSlop={10}
              accessibilityLabel="Toggle balance visibility"
            >
              <Ionicons
                name={showBalances ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color={`hsl(${theme.colors.foregroundSecondary})`}
              />
            </Pressable>
          </View>
          <View
            style={[
              styles.badge,
              {
                borderColor: `hsl(${theme.colors.brandPrimary} / 0.25)`,
                backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.08)`,
              },
            ]}
          >
            <Ionicons name="bar-chart-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, fontWeight: '600' }}>
              Spot Trading
            </Text>
          </View>
        </View>
        <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh balances">
          <Ionicons name="refresh" size={22} color={`hsl(${theme.colors.foregroundSecondary})`} />
        </Pressable>
      </View>

      <View style={styles.headerActions}>
        <PrimaryButton title="Deposit" onPress={() => navigation.navigate('DepositHome')} style={styles.headerBtn} />
        <Pressable
          onPress={() => navigation.navigate('Convert')}
          style={[styles.secondaryBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
        >
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>Convert</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Transfer')}
          style={[styles.secondaryBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
        >
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>Transfer</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('WalletHistory')}
          style={[styles.secondaryBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
        >
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>History</Text>
        </Pressable>
      </View>

      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached balances where available" onRetry={onRefresh} />
      ) : null}

      {tradingQ.isError ? (
        <ErrorBanner message="Balances could not be loaded." onRetry={onRefresh} />
      ) : null}

      {isLoading ? (
        <SkeletonList rows={6} />
      ) : tradingQ.isError && !tradingQ.data ? (
        <ErrorState title="Could not load trading account" onRetry={onRefresh} />
      ) : (
        <>
          <TradingEquitySummary
            totalEquity={tradingQ.data?.totalEquity ?? { usd: '0' }}
            availableBalance={tradingQ.data?.availableBalance ?? { usd: '0' }}
            unrealizedPnl={tradingQ.data?.unrealizedPnl ?? { usd: '0' }}
            showBalances={showBalances}
            onOpenPnl={() => navigation.navigate('WalletPnl')}
          />

          <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin…" />
          <View style={styles.toggleRow}>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
              Hide small balances
            </Text>
            <Switch value={hideSmall} onValueChange={setHideSmall} />
          </View>
          <Pressable onPress={() => navigation.navigate('Convert')} style={styles.convertLink}>
            <Ionicons name="sparkles-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
              Convert Small Balances
            </Text>
          </Pressable>
          {filtered.length > 0 ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginBottom: 8 }}>
              {filtered.length} asset{filtered.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <ScreenLayout testID="S-503">
      {!isLoading && !(tradingQ.isError && !tradingQ.data) ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.token_id ?? item.symbol}
          renderItem={renderRow}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={tradingQ.isFetching} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              title="No assets found"
              message={emptyMessage}
              actionLabel={
                !search.trim() && !(hideSmall && (tradingQ.data?.balances.length ?? 0) > 0)
                  ? 'Transfer Now'
                  : undefined
              }
              onAction={
                !search.trim() && !(hideSmall && (tradingQ.data?.balances.length ?? 0) > 0)
                  ? () => navigation.navigate('Transfer')
                  : undefined
              }
            />
          }
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={tradingQ.isFetching} onRefresh={onRefresh} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  headerBtn: { flexGrow: 1, minWidth: 100 },
  secondaryBtn: {
    flexGrow: 1,
    minWidth: 100,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  convertLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
});
