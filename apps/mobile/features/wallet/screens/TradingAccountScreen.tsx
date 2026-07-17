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
import { useTheme, hapticLight, hsl } from '@shared/theme';
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
      <View style={[styles.heroRow, { gap: theme.spacing[2.5], marginBottom: theme.spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <View style={[styles.titleRow, { gap: theme.spacing[2], marginBottom: theme.spacing[2] }]}>
            <Text
              style={[
                theme.typography.displayMd,
                { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
              ]}
            >
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
                size={theme.sizes.iconSm}
                color={hsl(theme.colors.foregroundSecondary)}
              />
            </Pressable>
          </View>
          <View
            style={[
              styles.badge,
              {
                gap: theme.spacing[1.5],
                paddingHorizontal: theme.spacing[2.5],
                paddingVertical: theme.spacing[1.5],
                borderRadius: theme.radius.md + 2,
                borderColor: `hsl(${theme.colors.brandPrimary} / 0.25)`,
                backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.08)`,
              },
            ]}
          >
            <Ionicons name="bar-chart-outline" size={theme.sizes.iconXs - 2} color={hsl(theme.colors.brandPrimary)} />
            <Text
              style={[
                theme.typography.bodySm,
                { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              Spot Trading
            </Text>
          </View>
        </View>
        <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh balances">
          <Ionicons name="refresh" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundSecondary)} />
        </Pressable>
      </View>

      <View style={[styles.headerActions, { gap: theme.spacing[2], marginBottom: theme.spacing[3.5] }]}>
        <PrimaryButton title="Deposit" onPress={() => navigation.navigate('DepositHome')} style={styles.headerBtn} />
        <Pressable
          onPress={() => navigation.navigate('Convert')}
          style={[
            styles.secondaryBtn,
            {
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
              borderRadius: theme.radius.md + 2,
              paddingHorizontal: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Convert
          </Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Transfer')}
          style={[
            styles.secondaryBtn,
            {
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
              borderRadius: theme.radius.md + 2,
              paddingHorizontal: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Transfer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('WalletHistory')}
          style={[
            styles.secondaryBtn,
            {
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
              borderRadius: theme.radius.md + 2,
              paddingHorizontal: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            History
          </Text>
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
          <View style={[styles.toggleRow, { marginVertical: theme.spacing[2] }]}>
            <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
              Hide small balances
            </Text>
            <Switch value={hideSmall} onValueChange={setHideSmall} />
          </View>
          <Pressable
            onPress={() => navigation.navigate('Convert')}
            style={[styles.convertLink, { gap: theme.spacing[1.5], marginBottom: theme.spacing[2.5] }]}
          >
            <Ionicons name="sparkles-outline" size={theme.sizes.iconXs} color={hsl(theme.colors.brandPrimary)} />
            <Text
              style={[
                theme.typography.bodyMd,
                { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              Convert Small Balances
            </Text>
          </Pressable>
          {filtered.length > 0 ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: hsl(theme.colors.foregroundSecondary), marginBottom: theme.spacing[2] },
              ]}
            >
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
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap' },
  headerBtn: { flexGrow: 1, minWidth: 100 },
  secondaryBtn: {
    flexGrow: 1,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convertLink: { flexDirection: 'row', alignItems: 'center' },
});
