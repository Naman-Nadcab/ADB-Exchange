import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  SkeletonList,
  EmptyState,
  PrimaryButton,
  ExchangeCard,
  PillTabBar,
  TerminalPanel,
  StatusChip,
  AccountEntryButton,
} from '@shared/ui';
import { GuestAuthPrompt, useGuestAccess } from '@features/auth';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useOpenOrders } from '@features/trade';
import { useOrderHistory, useTradeHistory } from '../hooks/useOrders';
import { OpenOrderRow } from '../components/OpenOrderRow';
import type { OrdersStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrdersHome'>;
type OrdersTab = 'open' | 'orders' | 'trades';

function HistoryOrderRow({
  side,
  market,
  type,
  quantity,
  price,
  status,
  time,
}: {
  side: string;
  market: string;
  type: string;
  quantity: string;
  price: string;
  status: string;
  time: string;
}) {
  const { theme } = useTheme();
  const sideColor = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
  const statusTone: 'live' | 'sync' | 'neutral' | 'off' =
    status === 'filled' || status === 'FILLED'
      ? 'live'
      : status === 'cancelled' || status === 'CANCELLED'
        ? 'neutral'
        : 'sync';

  return (
    <TerminalPanel subtle style={styles.historyRow}>
      <View style={styles.historyTop}>
        <View>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${sideColor})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'capitalize' }]}>
            {side} · {type.replace(/_/g, ' ')}
          </Text>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
            {market}
          </Text>
        </View>
        <StatusChip label={status} tone={statusTone} />
      </View>
      <Text style={[theme.typography.price, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono, marginTop: 8 }]}>
        {quantity} @ {price}
      </Text>
      <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }]}>
        {time}
      </Text>
    </TerminalPanel>
  );
}

export function OrdersHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isGuest } = useGuestAccess();
  const [tab, setTab] = useState<OrdersTab>('open');
  const authEnabled = !isGuest;
  const openQ = useOpenOrders(authEnabled);
  const orderHistQ = useOrderHistory(undefined, authEnabled);
  const tradeHistQ = useTradeHistory(undefined, authEnabled);

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
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.displayMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                letterSpacing: -0.3,
                marginBottom: theme.spacing[0.5],
              },
            ]}
          >
            Orders
          </Text>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[3.5] },
            ]}
          >
            Spot · Open · History · Fills
          </Text>
        </View>
        <AccountEntryButton />
      </View>

      {isGuest ? (
        <GuestAuthPrompt
          testID="S-400-guest"
          title="Sign in to view orders"
          message="Your open orders, order history, and trade fills appear here after you log in."
        />
      ) : (
      <>
      <ExchangeCard elevated style={styles.card}>
        <PillTabBar
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
            scrollEnabled={false}
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
            scrollEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={() => {
              if (orderHistQ.hasNextPage && !orderHistQ.isFetchingNextPage) void orderHistQ.fetchNextPage();
            }}
            renderItem={({ item }) => (
              <HistoryOrderRow
                side={item.side}
                market={item.market}
                type={item.type}
                quantity={item.quantity}
                price={item.price ?? 'MKT'}
                status={item.status}
                time={new Date(item.created_at).toLocaleString()}
              />
            )}
            ListEmptyComponent={!orderHistQ.isLoading ? <EmptyState title="No order history" /> : null}
          />
        ) : (
          <FlatList
            data={tradeItems}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={() => {
              if (tradeHistQ.hasNextPage && !tradeHistQ.isFetchingNextPage) void tradeHistQ.fetchNextPage();
            }}
            renderItem={({ item }) => (
              <HistoryOrderRow
                side={item.side}
                market={item.market}
                type="fill"
                quantity={item.quantity}
                price={item.price}
                status="filled"
                time={new Date(item.created_at ?? item.time ?? Date.now()).toLocaleString()}
              />
            )}
            ListEmptyComponent={!tradeHistQ.isLoading ? <EmptyState title="No trade fills" /> : null}
          />
        )}
      </ExchangeCard>

      <PrimaryButton
        title="P2P Orders"
        variant="ghost"
        size="md"
        onPress={() => navigation.getParent()?.navigate('P2P', { screen: 'OrdersList' })}
        style={{ marginTop: theme.spacing[3] }}
      />
      </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  card: { flex: 1, marginBottom: 8 },
  historyRow: { marginBottom: 8 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
});
