import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, StyleSheet, View, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  SearchBar,
  SkeletonList,
  EmptyState,
  FilterChip,
  ListColumnHeader,
  ErrorBanner,
} from '@shared/ui';
import { marketing } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { searchMarkets, trending, popularMarkets } from '@core/domain/markets/marketUtils';
import { MarketRow } from '../components/MarketRow';
import { useMarkets } from '../hooks/useMarkets';
import { useRecentMarkets } from '../hooks/useRecentMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { enrichWithIntelligence, useMarketIntelligence } from '../hooks/useMarketIntelligence';
import { useVisibleTickerSubscriptions } from '../hooks/useTickerSubscription';
import type { MarketsStackParamList } from '../navigation/types';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'MarketSearch'>;
type SearchSection = 'recent' | 'favorites' | 'trending' | 'popular';

export function MarketSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, error, refetch, isFetching } = useMarkets();
  const { data: intelligence } = useMarketIntelligence();
  const { recent, addRecent, clearRecent } = useRecentMarkets();
  const { favorites, isFavorite, toggle } = useFavorites();

  useEffect(() => {
    analytics.screen('S-201');
  }, []);

  const enriched = useMemo(
    () => enrichWithIntelligence(data ?? [], intelligence),
    [data, intelligence],
  );

  const instantResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchMarkets(enriched, query);
  }, [enriched, query]);

  const trendingItems = useMemo(() => trending(enriched, 8), [enriched]);
  const popularItems = useMemo(() => popularMarkets(enriched, 8), [enriched]);
  const favoriteItems = useMemo(
    () => enriched.filter((i) => favorites.includes(i.symbol)),
    [enriched, favorites],
  );
  const recentItems = useMemo(
    () => recent.map((sym) => enriched.find((i) => i.symbol === sym)).filter(Boolean) as MarketListItem[],
    [enriched, recent],
  );

  const [activeSection, setActiveSection] = useState<SearchSection>('recent');

  useEffect(() => {
    if (recentItems.length > 0) setActiveSection('recent');
    else if (favoriteItems.length > 0) setActiveSection('favorites');
    else setActiveSection('trending');
  }, [recentItems.length, favoriteItems.length]);

  const browseData = useMemo(() => {
    switch (activeSection) {
      case 'recent':
        return recentItems.length ? recentItems : trendingItems;
      case 'favorites':
        return favoriteItems.length ? favoriteItems : trendingItems;
      case 'popular':
        return popularItems;
      default:
        return trendingItems;
    }
  }, [activeSection, recentItems, favoriteItems, popularItems, trendingItems]);

  const results = query.trim() ? instantResults : browseData;
  const visibleSymbols = useMemo(() => results.slice(0, 20).map((i) => i.symbol), [results]);
  useVisibleTickerSubscriptions(visibleSymbols);

  const sectionLabel = query.trim()
    ? `Results (${instantResults.length})`
    : activeSection === 'recent'
      ? 'Recent'
      : activeSection === 'favorites'
        ? 'Favorites'
        : activeSection === 'popular'
          ? 'Popular'
          : 'Trending';

  const openPair = (symbol: string) => {
    addRecent(symbol);
    navigation.navigate('PairDetail', { symbol });
  };

  return (
    <ScreenLayout testID="S-201" style={{ backgroundColor: marketing.pageBg }}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        testID="market-search-input"
        placeholder="Search BTC, ETH, USDT pairs…"
      />

      {!query.trim() ? (
        <View style={styles.quickTabs}>
          {(['recent', 'favorites', 'trending', 'popular'] as SearchSection[]).map((id) => (
            <FilterChip
              key={id}
              label={id.charAt(0).toUpperCase() + id.slice(1)}
              selected={activeSection === id}
              onPress={() => setActiveSection(id)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={[styles.sectionLabel, { color: marketing.mutedText }]}>{sectionLabel.toUpperCase()}</Text>
        {!query.trim() && recent.length > 0 ? (
          <FilterChip label="Clear history" onPress={clearRecent} />
        ) : null}
      </View>

      {isError ? (
        <ErrorBanner message={error instanceof Error ? error.message : 'Failed to load markets'} onRetry={() => void refetch()} />
      ) : null}

      <ListColumnHeader
        columns={[
          { label: 'Pair', flex: 1.4 },
          { label: 'Chart', flex: 0.5, align: 'center' },
          { label: 'Price', flex: 0.9, align: 'right' },
        ]}
      />

      {isLoading && !data ? (
        <SkeletonList rows={6} />
      ) : results.length === 0 ? (
        <EmptyState
          title={query ? 'No results' : 'Nothing here yet'}
          message={query ? 'Try another symbol or quote asset' : 'Markets you open will appear in recent searches'}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.symbol}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={marketing.gold} />
          }
          renderItem={({ item }) => (
            <MarketRow
              item={item}
              variant="flat"
              isFavorite={isFavorite(item.symbol)}
              onLongPress={() => toggle(item.symbol)}
              onPress={() => openPair(item.symbol)}
            />
          )}
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={5}
          ListFooterComponent={
            !query.trim() ? (
              <View style={styles.footerSections}>
                {activeSection !== 'trending' && trendingItems.length > 0 ? (
                  <SectionBlock title="Trending" items={trendingItems} onSelect={openPair} isFavorite={isFavorite} toggle={toggle} />
                ) : null}
                {activeSection !== 'popular' && popularItems.length > 0 ? (
                  <SectionBlock title="Popular" items={popularItems} onSelect={openPair} isFavorite={isFavorite} toggle={toggle} />
                ) : null}
                {favoriteItems.length > 0 && activeSection !== 'favorites' ? (
                  <SectionBlock title="Favorites" items={favoriteItems} onSelect={openPair} isFavorite={isFavorite} toggle={toggle} />
                ) : null}
              </View>
            ) : null
          }
        />
      )}
    </ScreenLayout>
  );
}

function SectionBlock({
  title,
  items,
  onSelect,
  isFavorite,
  toggle,
}: {
  title: string;
  items: MarketListItem[];
  onSelect: (symbol: string) => void;
  isFavorite: (s: string) => boolean;
  toggle: (s: string) => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionLabel, { color: marketing.mutedText, marginBottom: 6 }]}>{title.toUpperCase()}</Text>
      {items.slice(0, 5).map((item) => (
        <MarketRow
          key={item.symbol}
          item={item}
          variant="flat"
          isFavorite={isFavorite(item.symbol)}
          onLongPress={() => toggle(item.symbol)}
          onPress={() => onSelect(item.symbol)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  quickTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  footerSections: { marginTop: 16, gap: 12, paddingBottom: 24 },
  sectionBlock: { marginTop: 4 },
});
