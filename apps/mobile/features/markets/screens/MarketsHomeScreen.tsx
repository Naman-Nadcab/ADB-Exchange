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
import { useTheme, hapticSelection } from '@shared/theme';
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
import {
  topGainers,
  topLosers,
  trending,
  newListingsPreview,
  aggregateMarketStats,
} from '@core/domain/markets/marketUtils';
import { MarketRow } from '../components/MarketRow';
import { MarketsHeaderWidgets } from '../components/MarketsHeaderWidgets';
import { MarketsMetricsRow } from '../components/MarketsMetricsRow';
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
  { id: 'trending', label: 'Trending' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'new', label: 'New' },
];

const SORT_OPTIONS: { id: MarketSortKey; label: string }[] = [
  { id: 'volume', label: 'Volume' },
  { id: 'change', label: 'Change' },
  { id: 'name', label: 'Name' },
  { id: 'price', label: 'Price' },
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
  const [sortKey, setSortKey] = useState<MarketSortKey>(
    (mmkvStorage.getString(CACHE_KEYS.marketSort) as MarketSortKey) ?? 'volume',
  );
  const [page, setPage] = useState(1);
  const [searchLocal, setSearchLocal] = useState('');

  useEffect(() => {
    analytics.screen('S-200');
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, quote, sortKey, searchLocal]);

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
      gainers: topGainers(items, 4),
      losers: topLosers(items, 4),
      trending: trending(items, 4),
      newListings: newListingsPreview(items, 4),
    }),
    [items],
  );

  const stats = useMemo(() => aggregateMarketStats(items), [items]);
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

  const cycleSort = () => {
    void hapticSelection();
    const idx = SORT_OPTIONS.findIndex((s) => s.id === sortKey);
    const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id;
    setSortKey(next);
    mmkvStorage.set(CACHE_KEYS.marketSort, next);
  };

  const toggleQuote = () => {
    void hapticSelection();
    const next = quote === 'USDT' ? null : 'USDT';
    setQuote(next);
    if (next) mmkvStorage.set(CACHE_KEYS.quoteCurrency, next);
    else mmkvStorage.remove(CACHE_KEYS.quoteCurrency);
  };

  const ListHeader = (
    <>
      <View style={styles.header}>
        <View>
          <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            Markets
          </Text>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
            Explore spot pairs and live prices
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('MarketSearch')}
          accessibilityRole="button"
          accessibilityLabel="Search markets"
          style={[styles.searchBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
        >
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Search</Text>
        </Pressable>
      </View>
      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached markets" onRetry={() => void refetch()} />
      ) : null}
      {staleLabel ? (
        <Text style={[styles.stale, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{staleLabel}</Text>
      ) : null}
      <MarketsMetricsRow
        pairsCount={stats.pairsCount}
        totalVolume={stats.totalVolume}
        gainers={stats.gainers}
        losers={stats.losers}
      />
      <MarketsHeaderWidgets
        gainers={widgets.gainers}
        losers={widgets.losers}
        trending={widgets.trending}
        newListings={widgets.newListings}
        onSelect={openDetail}
      />
      <SearchBar value={searchLocal} onChangeText={setSearchLocal} placeholder="Search by symbol or name" />
      <SegmentControl tabs={TABS} active={tab} onChange={(id) => setTab(id as MarketTab)} />
      <View style={styles.filters}>
        <Pressable onPress={toggleQuote} style={styles.filterChip} accessibilityRole="button">
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            Quote: {quote ?? 'All'}
          </Text>
        </Pressable>
        <Pressable onPress={cycleSort} style={styles.filterChip} accessibilityRole="button">
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            Sort: {SORT_OPTIONS.find((s) => s.id === sortKey)?.label}
          </Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <ScreenLayout testID="S-200">
      {isLoading && !data ? (
        <>
          {ListHeader}
          <SkeletonList />
        </>
      ) : isError ? (
        <>
          {ListHeader}
          <EmptyState
            title="Could not load markets"
            message={error instanceof Error ? error.message : 'Try again'}
            onAction={() => void refetch()}
            actionLabel="Retry"
          />
        </>
      ) : paged.length === 0 ? (
        <>
          {ListHeader}
          <EmptyState
            title={tab === 'favorites' ? 'No favorites yet' : 'No markets found'}
            message={tab === 'favorites' ? 'Long press a market to add favorites' : undefined}
          />
        </>
      ) : (
        <FlatList
          data={paged}
          keyExtractor={(item) => item.symbol}
          ListHeaderComponent={ListHeader}
          renderItem={({ item, index }) => (
            <MarketRow
              item={item}
              rank={tab === 'all' || tab === 'trending' ? index + 1 : undefined}
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
          getItemLayout={(_, index) => ({ length: 68, offset: 68 * index, index })}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  searchBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
  stale: { fontSize: 11, marginBottom: 8 },
  filters: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  filterChip: { minHeight: 32, justifyContent: 'center' },
});
