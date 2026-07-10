import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useOrderHistory } from '../hooks/useOrders';
import { TxHistoryRow } from '@shared/ui';
import type { OrdersStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderHistory'>;

export function OrderHistoryScreen(_props: Props) {
  const [market, setMarket] = useState('');
  const q = useOrderHistory(market || undefined);

  useEffect(() => {
    analytics.screen('S-402');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-402">
      <SearchBar value={market} onChangeText={setMarket} placeholder="Filter by market (e.g. BTC_USDT)" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.side} ${item.type} ${item.market}`}
            value={`${item.quantity} @ ${item.price ?? 'MKT'}`}
            sub={`${item.status} · ${new Date(item.created_at).toLocaleString()}`}
            direction={item.side === 'buy' ? 'in' : 'out'}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No order history" /> : null}
      />
    </ScreenLayout>
  );
}
