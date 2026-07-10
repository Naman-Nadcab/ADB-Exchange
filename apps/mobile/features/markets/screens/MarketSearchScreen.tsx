import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SkeletonList, EmptyState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { searchMarkets } from '@core/domain/markets/marketUtils';
import { MarketRow } from '../components/MarketRow';
import { useMarkets } from '../hooks/useMarkets';
import { useRecentMarkets } from '../hooks/useRecentMarkets';
import type { MarketsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'MarketSearch'>;

export function MarketSearchScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useMarkets();
  const { recent } = useRecentMarkets();

  useEffect(() => {
    analytics.screen('S-201');
  }, []);

  const results = useMemo(() => {
    const items = data ?? [];
    if (!query.trim()) {
      return items.filter((i) => recent.includes(i.symbol));
    }
    return searchMarkets(items, query);
  }, [data, query, recent]);

  return (
    <ScreenLayout testID="S-201">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Search</Text>
      <SearchBar value={query} onChangeText={setQuery} testID="market-search-input" />
      {isLoading && !data ? (
        <SkeletonList rows={6} />
      ) : results.length === 0 ? (
        <EmptyState
          title={query ? 'No results' : 'Recently viewed'}
          message={query ? 'Try another symbol' : 'Markets you open will appear here'}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.symbol}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <MarketRow
              item={item}
              onPress={() => navigation.navigate('PairDetail', { symbol: item.symbol })}
            />
          )}
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
});
