import { useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useMarkets, useMarketsList, useFavorites, MarketRow } from '@features/markets';
import { useTradeStore } from '@core/state/tradeStore';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'PairSelector'>;

export function PairSelectorScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data } = useMarkets();
  const { favorites } = useFavorites();
  const setSymbol = useTradeStore((s) => s.setSymbol);

  useEffect(() => {
    analytics.screen('S-301');
  }, []);

  const list = useMarketsList({
    items: data ?? [],
    tab: 'all',
    favorites,
    quote: null,
    sortKey: 'volume',
    search: query,
  });

  return (
    <ScreenLayout testID="S-301">
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search pairs" />
      <FlatList
        data={list}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <MarketRow
            item={item}
            onPress={() => {
              setSymbol(item.symbol);
              navigation.navigate('SpotTrading', { symbol: item.symbol });
            }}
          />
        )}
        initialNumToRender={20}
      />
    </ScreenLayout>
  );
}
