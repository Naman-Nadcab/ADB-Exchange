import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@shared/theme';
import {
  ScreenLayout,
  SegmentControl,
  SkeletonList,
  EmptyState,
  ErrorBanner,
  SearchBar,
} from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { topGainers, topLosers, trending } from '@core/domain/markets/marketUtils';
import { MarketRow } from '../components/MarketRow';
import { MarketsHeaderWidgets } from '../components/MarketsHeaderWidgets';
import { useMarkets } from '../hooks/useMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { useMarketsList } from '../hooks/useMarketsList';
import { useVisibleTickerSubscriptions } from '../hooks/useTickerSubscription';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import type { MarketsStackParamList } from '../navigation/types';
import type { MarketSortKey, MarketTab } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'MarketsHome'>;

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'all', label: 'All' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

const PAGE_SIZE = 30;

export function MarketsHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useMarkets();
  const { favorites, toggle, isFavorite } = useFavorites();
  const [tab, setTab] = useState<MarketTab>('all');
  const [quote, setQuote] = useState<string | null>(
    mmkvStorage.getString(CACHE_KEYS.quoteCurrency) ?? null,
  );
  const [sortKey] = useState<MarketSortKey>(
    (mmkvStorage.getString(CACHE_KEYS.marketSort) as MarketSortKey) ?? 'volume',
  );
  const [page, setPage] = useState(1);
  const [searchLocal, setSearchLocal] = useState('');

  useEffect(() => {
    analytics.screen('S-200');
  }, []);

  const items = useMemo(() => data ?? [], [data]);
  const list = useMarketsList({
    items,
    tab,
    favorites,
    quote,
    sortKey,
    search: searchLocal,
  });

  const visibleSymbols = useMemo(
    () => list.slice(0, page * PAGE_SIZE).map((i) => i.symbol),
    [list, page],
  );
  useVisibleTickerSubscriptions(visibleSymbols);

  const widgets = useMemo(
    () => ({
      gainers: topGainers(items, 3),
      losers: topLosers(items, 3),
      trending: trending(items, 3),
    }),
    [items],
  );

  const paged = useMemo(() => list.slice(0, page * PAGE_SIZE), [list, page]);

  const onEndReached = useCallback(() => {
    if (page * PAGE_SIZE < list.length) setPage((p) => p + 1);
  }, [page, list.length]);

  const openDetail = useCallback(
    (symbol: string) => navigation.navigate('PairDetail', { symbol }),
    [navigation],
  );

  const staleLabel = dataUpdatedAt
    ? `Updated ${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
    : '';

  const openAccount = useCallback(() => {
    let nav = navigation.getParent();
    while (nav?.getParent()) nav = nav.getParent();
    (nav as { navigate: (name: string) => void } | undefined)?.navigate('Account');
  }, [navigation]);

  return (
    <ScreenLayout testID="S-200">
      <View style={styles.header}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Markets</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={openAccount} accessibilityRole="button" accessibilityLabel="Account">
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Account</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('MarketSearch')} accessibilityRole="button">
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Search</Text>
          </Pressable>
        </View>
      </View>
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached markets" onRetry={() => void refetch()} />
      ) : null}
      {staleLabel ? (
        <Text style={[styles.stale, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{staleLabel}</Text>
      ) : null}
      <SearchBar value={searchLocal} onChangeText={setSearchLocal} placeholder="Filter markets" />
      <MarketsHeaderWidgets
        gainers={widgets.gainers}
        losers={widgets.losers}
        trending={widgets.trending}
        onSelect={openDetail}
      />
      <SegmentControl tabs={TABS} active={tab} onChange={(id) => setTab(id as MarketTab)} />
      <Pressable
        onPress={() => setQuote(quote === 'USDT' ? null : 'USDT')}
        style={styles.quoteFilter}
        accessibilityRole="button"
        accessibilityLabel="Quote currency filter"
      >
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
          Quote: {quote ?? 'All'}
        </Text>
      </Pressable>
      {isLoading && !data ? (
        <SkeletonList />
      ) : isError ? (
        <EmptyState
          title="Could not load markets"
          message={error instanceof Error ? error.message : 'Try again'}
          onAction={() => void refetch()}
          actionLabel="Retry"
        />
      ) : paged.length === 0 ? (
        <EmptyState
          title={tab === 'favorites' ? 'No favorites yet' : 'No markets found'}
          message={tab === 'favorites' ? 'Long press a market to add favorites' : undefined}
        />
      ) : (
        <FlatList
          data={paged}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <MarketRow
              item={item}
              onPress={() => openDetail(item.symbol)}
              onLongPress={() => toggle(item.symbol)}
              isFavorite={isFavorite(item.symbol)}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerActions: { flexDirection: 'row', gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  stale: { fontSize: 11, marginBottom: 8 },
  quoteFilter: { marginBottom: 8, minHeight: 32, justifyContent: 'center' },
});
