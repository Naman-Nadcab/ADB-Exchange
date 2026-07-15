import { useEffect, useMemo, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  SkeletonList,
  ErrorBanner,
  ErrorState,
} from '@shared/ui';
import { useTicker } from '@features/markets';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import { computeAssetHoldings } from '@core/domain/wallet/assetDetail';
import {
  useFundingBalances,
  useSpotAccountBalances,
  useCoinInfo,
  useAssetTransactions,
} from '../hooks/useWallet';
import { useTokenChains, useDepositTokens } from '../hooks/useBlockchainWallet';
import { AssetDetailHeader } from '../components/AssetDetailHeader';
import { AssetPortfolioSection } from '../components/AssetPortfolioSection';
import { AssetQuickActions } from '../components/AssetQuickActions';
import { AssetNetworksSection } from '../components/AssetNetworksSection';
import { AssetMarketSection } from '../components/AssetMarketSection';
import { RecentTransactionsList } from '../components/RecentTransactionsList';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AssetDetail'>;

export function AssetDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const isOnline = useAppStore((s) => s.isOnline);
  const showBalances = useWalletPrefsStore((s) => s.showBalances);
  const favorites = useWalletPrefsStore((s) => s.favorites);
  const hydrate = useWalletPrefsStore((s) => s.hydrate);
  const toggleFavorite = useWalletPrefsStore((s) => s.toggleFavorite);

  const pairSymbol = `${symbol}_USDT`;
  const fundingQ = useFundingBalances();
  const spotQ = useSpotAccountBalances();
  const tickerQ = useTicker(pairSymbol);
  const coinQ = useCoinInfo(symbol);
  const chainsQ = useTokenChains(symbol);
  const depositTokensQ = useDepositTokens();
  const txQ = useAssetTransactions(symbol, 50);

  useEffect(() => {
    hydrate();
    analytics.screen('S-501');
  }, [hydrate]);

  const fundingRow = useMemo(
    () => fundingQ.data?.balances.find((b) => b.symbol === symbol),
    [fundingQ.data, symbol],
  );
  const spotRow = useMemo(
    () => spotQ.data?.find((b) => b.asset === symbol),
    [spotQ.data, symbol],
  );
  const depositToken = useMemo(
    () => depositTokensQ.data?.find((t) => t.symbol === symbol),
    [depositTokensQ.data, symbol],
  );

  const holdings = useMemo(
    () => computeAssetHoldings(fundingRow, spotRow),
    [fundingRow, spotRow],
  );

  const livePrice = tickerQ.data?.last_price
    ? parseFloat(tickerQ.data.last_price)
    : coinQ.data?.current_price ?? 0;
  const change24h = tickerQ.data?.change_pct ?? coinQ.data?.price_change_percentage_24h ?? null;
  const holdingsUsdStr =
    livePrice > 0 ? String(holdings.grandTotal * livePrice) : (fundingRow?.usd_value ?? '0');

  const balancesLoading = (fundingQ.isLoading || spotQ.isLoading) && !fundingQ.data && !spotQ.data;
  const balancesError = fundingQ.isError || spotQ.isError;

  const refreshing =
    fundingQ.isFetching ||
    spotQ.isFetching ||
    tickerQ.isFetching ||
    coinQ.isFetching ||
    chainsQ.isFetching ||
    txQ.isFetching;

  const onRefresh = useCallback(() => {
    void fundingQ.refetch();
    void spotQ.refetch();
    void tickerQ.refetch();
    void coinQ.refetch();
    void chainsQ.refetch();
    void txQ.refetch();
    void depositTokensQ.refetch();
  }, [fundingQ, spotQ, tickerQ, coinQ, chainsQ, txQ, depositTokensQ]);

  const coinName = coinQ.data?.name ?? fundingRow?.name ?? symbol;

  const requireNav = (fn: () => void) => fn();

  return (
    <ScreenLayout testID="S-501">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!isOnline ? (
          <ErrorBanner message="Offline — showing cached data where available" onRetry={onRefresh} />
        ) : null}

        {balancesError ? (
          <ErrorBanner message="Portfolio could not be loaded. Pull to refresh or tap retry." onRetry={onRefresh} />
        ) : null}

        {balancesLoading ? (
          <SkeletonList rows={8} />
        ) : balancesError && !fundingQ.data ? (
          <ErrorState title="Could not load asset" onRetry={onRefresh} />
        ) : (
          <>
            <AssetDetailHeader
              symbol={symbol}
              name={coinName}
              image={coinQ.data?.image}
              rank={coinQ.data?.market_cap_rank}
              price={livePrice > 0 ? livePrice : null}
              change24h={change24h}
              holdingsUsd={holdingsUsdStr}
              showBalances={showBalances}
              isFavorite={favorites.has(symbol)}
              onToggleFavorite={() => toggleFavorite(symbol)}
              priceStale={tickerQ.data?.last_price_stale}
            />

            <AssetQuickActions
              actions={[
                {
                  id: 'deposit',
                  label: 'Deposit',
                  icon: 'arrow-down-circle',
                  primary: true,
                  onPress: () =>
                    requireNav(() =>
                      navigation.navigate('DepositNetwork', { symbol, name: coinName }),
                    ),
                },
                {
                  id: 'withdraw',
                  label: 'Withdraw',
                  icon: 'arrow-up-circle',
                  onPress: () =>
                    requireNav(() => navigation.navigate('WithdrawNetwork', { symbol, name: coinName })),
                },
                {
                  id: 'transfer',
                  label: 'Transfer',
                  icon: 'swap-horizontal',
                  onPress: () => requireNav(() => navigation.navigate('Transfer')),
                },
                {
                  id: 'convert',
                  label: 'Convert',
                  icon: 'repeat',
                  onPress: () => requireNav(() => navigation.navigate('Convert')),
                },
                {
                  id: 'trade',
                  label: 'Trade',
                  icon: 'trending-up',
                  onPress: () =>
                    navigation.getParent()?.navigate('Trade', {
                      screen: 'SpotTrading',
                      params: { symbol: pairSymbol },
                    }),
                },
              ]}
            />

            <AssetPortfolioSection
              symbol={symbol}
              holdings={holdings}
              priceUsd={livePrice > 0 ? livePrice : 0}
              showBalances={showBalances}
            />

            <AssetNetworksSection
              chains={chainsQ.data ?? []}
              token={depositToken}
              loading={chainsQ.isLoading}
              error={chainsQ.isError}
              onRetry={() => void chainsQ.refetch()}
            />

            <AssetMarketSection
              ticker={tickerQ.data}
              coinInfo={coinQ.data}
              loading={tickerQ.isLoading && coinQ.isLoading}
              error={tickerQ.isError && coinQ.isError}
              onRetry={() => {
                void tickerQ.refetch();
                void coinQ.refetch();
              }}
            />

            <RecentTransactionsList
              items={txQ.data?.items ?? []}
              isLoading={txQ.isLoading}
              error={txQ.isError ? 'Could not load transaction history.' : null}
              onRetry={() => void txQ.refetch()}
              onViewAll={() => navigation.navigate('TransactionHistory')}
            />
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
});
