import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection, marketing } from '@shared/theme';
import {
  ScreenLayout,
  SegmentControl,
  SkeletonList,
  EmptyState,
  ErrorBanner,
  FilterChip,
  ListColumnHeader,
  AccountEntryButton,
} from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import {
  topGainers,
  topLosers,
  trending,
  newListingsPreview,
  aggregateMarketStats,
  marketPulse,
  heatmapRows,
} from '@core/domain/markets/marketUtils';
import { filterBySector, type MarketSector } from '@core/domain/markets/sectors';
import { MarketRow } from '../components/MarketRow';
import { MarketsHeaderWidgets } from '../components/MarketsHeaderWidgets';
import { MarketsGlobalStats } from '../components/MarketsGlobalStats';
import { MarketsCategoryChips } from '../components/MarketsCategoryChips';
import { MarketsIntelligencePanel } from '../components/MarketsIntelligencePanel';
import { MarketsHeatmapSection } from '../components/MarketsHeatmapSection';
import { useMarkets } from '../hooks/useMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { useMarketsList } from '../hooks/useMarketsList';
import { enrichWithIntelligence, useMarketIntelligence } from '../hooks/useMarketIntelligence';
import { useVisibleTickerSubscriptions } from '../hooks/useTickerSubscription';
import { useAnnouncements, partitionAnnouncements } from '../hooks/useAnnouncements';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import type { MarketsStackParamList } from '../navigation/types';
import type { MarketSortKey, MarketTab } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'MarketsHome'>;

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'favorites', label: 'Watchlist' },
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'new', label: 'New' },
];

const QUOTE_OPTIONS: (string | null)[] = [null, 'USDT', 'BTC', 'USDC', 'INR'];

const SORT_OPTIONS: { id: MarketSortKey; label: string }[] = [
  { id: 'volume', label: 'Volume' },
  { id: 'change', label: '24H %' },
  { id: 'price', label: 'Price' },
  { id: 'name', label: 'A–Z' },
  { id: 'change7d', label: '7D %' },
  { id: 'marketCap', label: 'MCap' },
];

const PAGE_SIZE = 30;

export function MarketsHomeScreen({ navigation }: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useMarkets();
  const { data: intelligence } = useMarketIntelligence();
  const { data: announcementData } = useAnnouncements(12);
  const { favorites, toggle, isFavorite } = useFavorites();
  const [tab, setTab] = useState<MarketTab>('all');
  const [quote, setQuote] = useState<string | null>(
    mmkvStorage.getString(CACHE_KEYS.quoteCurrency) ?? null,
  );
  const [sortKey, setSortKey] = useState<MarketSortKey>(
    (mmkvStorage.getString(CACHE_KEYS.marketSort) as MarketSortKey) ?? 'volume',
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    (mmkvStorage.getString(CACHE_KEYS.marketSortDir) as 'asc' | 'desc') ?? 'desc',
  );
  const [category, setCategory] = useState<MarketSector | null>(
    (mmkvStorage.getString(CACHE_KEYS.marketCategory) as MarketSector | null) ?? null,
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    analytics.screen('S-200');
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, quote, sortKey, sortDir, category]);

  const enriched = useMemo(() => enrichWithIntelligence(data ?? [], intelligence), [data, intelligence]);
  const items = useMemo(
    () => (category ? filterBySector(enriched, category) : enriched),
    [enriched, category],
  );

  const list = useMarketsList({
    items,
    tab,
    favorites,
    quote,
    sortKey,
    sortDir,
    search: '',
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
  const pulse = useMemo(() => marketPulse(items), [items]);
  const heatmap = useMemo(() => heatmapRows(items, 12), [items]);
  const paged = useMemo(() => list.slice(0, page * PAGE_SIZE), [list, page]);
  const { news, announcements } = useMemo(
    () => partitionAnnouncements(announcementData ?? []),
    [announcementData],
  );

  const onEndReached = useCallback(() => {
    if (page * PAGE_SIZE < list.length) setPage((p) => p + 1);
  }, [page, list.length]);

  const openDetail = useCallback(
    (symbol: string) => navigation.navigate('PairDetail', { symbol }),
    [navigation],
  );

  const staleLabel = dataUpdatedAt
    ? `${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
    : '';

  const cycleSort = () => {
    void hapticSelection();
    const idx = SORT_OPTIONS.findIndex((s) => s.id === sortKey);
    const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id;
    setSortKey(next);
    mmkvStorage.set(CACHE_KEYS.marketSort, next);
  };

  const toggleSortDir = () => {
    void hapticSelection();
    const next = sortDir === 'desc' ? 'asc' : 'desc';
    setSortDir(next);
    mmkvStorage.set(CACHE_KEYS.marketSortDir, next);
  };

  const onCategoryChange = (next: MarketSector | null) => {
    setCategory(next);
    if (next) mmkvStorage.set(CACHE_KEYS.marketCategory, next);
    else mmkvStorage.remove(CACHE_KEYS.marketCategory);
  };

  const ListHeader = (
    <>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>SPOT MARKETS</Text>
          <Text style={styles.heroTitle}>Markets</Text>
          <Text style={styles.heroSub}>Live prices · {stats.pairsCount} pairs</Text>
        </View>
        <View style={styles.heroActions}>
          {staleLabel ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{staleLabel}</Text>
            </View>
          ) : null}
          <AccountEntryButton />
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate('MarketSearch')}
        style={[styles.searchHero, { borderColor: marketing.goldBorder }]}
        accessibilityRole="button"
        accessibilityLabel="Search markets"
      >
        <Ionicons name="search" size={18} color={marketing.mutedText} />
        <Text style={styles.searchPlaceholder}>Search by symbol or name</Text>
      </Pressable>

      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached markets" onRetry={() => void refetch()} />
      ) : null}

      <MarketsGlobalStats
        pairsCount={stats.pairsCount}
        totalVolume={stats.totalVolume}
        gainers={stats.gainers}
        losers={stats.losers}
        fearGreedIndex={intelligence?.sentiment.fear_greed_index}
        fearGreedLabel={intelligence?.sentiment.fear_greed_label}
        globalMarketCap={intelligence?.total_market_cap}
        btcDominance={intelligence?.btc_dominance}
        intelligenceVolume={intelligence?.total_volume_24h}
        bullishPct={pulse.bullishPct}
      />

      <MarketsHeaderWidgets
        gainers={widgets.gainers}
        losers={widgets.losers}
        trending={widgets.trending}
        newListings={widgets.newListings}
        onSelect={openDetail}
      />

      <MarketsIntelligencePanel
        news={news}
        announcements={announcements}
        newListings={widgets.newListings}
        bullishPct={pulse.bullishPct}
        bearishPct={pulse.bearishPct}
        onSelectPair={openDetail}
      />

      <MarketsHeatmapSection rows={heatmap} onSelect={openDetail} />

      <SegmentControl tabs={TABS} active={tab} onChange={(id) => setTab(id as MarketTab)} />

      <MarketsCategoryChips active={category} onChange={onCategoryChange} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quoteScroll} contentContainerStyle={styles.filters}>
        {QUOTE_OPTIONS.map((q) => (
          <FilterChip
            key={q ?? 'all'}
            label={q ?? 'All Quotes'}
            selected={quote === q}
            onPress={() => {
              void hapticSelection();
              setQuote(q);
              if (q) mmkvStorage.set(CACHE_KEYS.quoteCurrency, q);
              else mmkvStorage.remove(CACHE_KEYS.quoteCurrency);
            }}
          />
        ))}
        <FilterChip
          label={`Sort: ${SORT_OPTIONS.find((s) => s.id === sortKey)?.label}`}
          selected
          onPress={cycleSort}
        />
        <FilterChip label={sortDir === 'desc' ? '↓ Desc' : '↑ Asc'} selected onPress={toggleSortDir} />
      </ScrollView>

      <ListColumnHeader
        columns={[
          { label: 'Pair / Vol', flex: 1.4 },
          { label: 'Chart', flex: 0.5, align: 'center' },
          { label: 'Last / 24h', flex: 0.9, align: 'right' },
        ]}
      />
    </>
  );

  return (
    <ScreenLayout testID="S-200" style={{ backgroundColor: marketing.pageBg }} edges={['top', 'left', 'right']}>
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
            title={tab === 'favorites' ? 'Watchlist is empty' : 'No markets found'}
            message={tab === 'favorites' ? 'Long press a market to add to your watchlist' : 'Try another filter or category'}
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
              variant="flat"
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor={marketing.gold}
            />
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  heroActions: { alignItems: 'flex-end', gap: 8 },
  heroEyebrow: {
    color: marketing.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: marketing.mutedText,
    fontSize: 13,
    marginTop: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: marketing.cardBg,
    borderWidth: 1,
    borderColor: marketing.goldBorder,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveText: { color: marketing.mutedText, fontSize: 10, fontWeight: '600' },
  searchHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: marketing.cardBg,
    marginBottom: 14,
    minHeight: 48,
  },
  searchPlaceholder: { color: marketing.mutedText, fontSize: 14, flex: 1 },
  quoteScroll: { marginBottom: 6, maxHeight: 44 },
  filters: { flexDirection: 'row', gap: 8, paddingRight: 8 },
});
