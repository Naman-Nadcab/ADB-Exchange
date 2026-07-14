import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  TerminalTabs,
  SkeletonList,
  EmptyState,
  PrimaryButton,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useOpenOrders } from '@features/trade';
import { useOrderHistory, useTradeHistory } from '../hooks/useOrders';
import { OpenOrderRow } from '../components/OpenOrderRow';
import { TxHistoryRow } from '@shared/ui';
import type { OrdersStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrdersHome'>;
type OrdersTab = 'open' | 'orders' | 'trades';

export function OrdersHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<OrdersTab>('open');
  const openQ = useOpenOrders();
  const orderHistQ = useOrderHistory();
  const tradeHistQ = useTradeHistory();

  useEffect(() => {
    analytics.screen('S-400');
  }, []);

  const openOrders = openQ.data ?? [];
  const orderItems = useMemo(() => orderHistQ.data?.pages.flatMap((p) => p) ?? [], [orderHistQ.data]);
  const tradeItems = useMemo(() => tradeHistQ.data?.pages.flatMap((p) => p) ?? [], [tradeHistQ.data]);

  const refreshing =
    tab === 'open' ? openQ.isFetching : tab === 'orders' ? orderHistQ.isFetching : tradeHistQ.isFetching;

  const onRefresh = () => {
    if (tab === 'open') void openQ.refetch();
    else if (tab === 'orders') void orderHistQ.refetch();
    else void tradeHistQ.refetch();
  };

  return (
    <ScreenLayout testID="S-400">
      <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: 4 }]}>
        Orders
      </Text>
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }]}>
        Open orders, history, and fills
      </Text>

      <TerminalTabs
        tabs={[
          { id: 'open', label: `Open (${openOrders.length})` },
          { id: 'orders', label: 'History' },
          { id: 'trades', label: 'Fills' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as OrdersTab)}
      />

      {tab === 'open' && openQ.isLoading && !openQ.data ? (
        <SkeletonList />
      ) : tab === 'open' ? (
        <FlatList
          data={openOrders}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <OpenOrderRow order={item} />}
          ListEmptyComponent={
            <EmptyState title="No open orders" message="Your active spot orders will appear here" />
          }
        />
      ) : tab === 'orders' ? (
        <FlatList
          data={orderItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (orderHistQ.hasNextPage && !orderHistQ.isFetchingNextPage) void orderHistQ.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <TxHistoryRow
              label={`${item.side} ${item.type} ${item.market}`}
              value={`${item.quantity} @ ${item.price ?? 'MKT'}`}
              sub={`${item.status} · ${new Date(item.created_at).toLocaleString()}`}
              direction={item.side === 'buy' ? 'in' : 'out'}
            />
          )}
          ListEmptyComponent={!orderHistQ.isLoading ? <EmptyState title="No order history" /> : null}
        />
      ) : (
        <FlatList
          data={tradeItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (tradeHistQ.hasNextPage && !tradeHistQ.isFetchingNextPage) void tradeHistQ.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <TxHistoryRow
              label={`${item.side} ${item.market}`}
              value={`${item.quantity} @ ${item.price}`}
              sub={new Date(item.created_at ?? item.time ?? Date.now()).toLocaleString()}
              direction={item.side === 'buy' ? 'in' : 'out'}
            />
          )}
          ListEmptyComponent={!tradeHistQ.isLoading ? <EmptyState title="No trade history" /> : null}
        />
      )}

      <PrimaryButton
        title="P2P Orders"
        variant="ghost"
        size="md"
        onPress={() => navigation.getParent()?.navigate('P2P', { screen: 'OrdersList' })}
        style={{ marginTop: 12 }}
      />
    </ScreenLayout>
  );
}
