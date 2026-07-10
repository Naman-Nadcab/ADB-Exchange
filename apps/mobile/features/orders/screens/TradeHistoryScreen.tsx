import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useTradeHistory } from '../hooks/useOrders';
import { TxHistoryRow } from '@shared/ui';
import type { OrdersStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'TradeHistory'>;

export function TradeHistoryScreen(_props: Props) {
  const [market, setMarket] = useState('');
  const q = useTradeHistory(market || undefined);

  useEffect(() => {
    analytics.screen('S-403');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-403">
      <SearchBar value={market} onChangeText={setMarket} placeholder="Filter by market" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.side} ${item.market}`}
            value={`${item.quantity} @ ${item.price}`}
            sub={new Date(item.created_at ?? item.time ?? Date.now()).toLocaleString()}
            direction={item.side === 'buy' ? 'in' : 'out'}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No trade history" /> : null}
      />
    </ScreenLayout>
  );
}
