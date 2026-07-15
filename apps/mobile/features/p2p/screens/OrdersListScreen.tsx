import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View, StyleSheet, RefreshControl, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SkeletonList,
  EmptyState,
  ErrorState,
  FilterChip,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';
import { analytics } from '@core/observability/analytics';
import {
  computeOrderListStats,
  ORDER_FILTER_LABEL,
  ORDER_STATUS_FILTERS,
  sortOrdersByCreatedDesc,
} from '@core/domain/p2p/ordersList';
import { useMyP2POrders, useP2PSubscriptions } from '../hooks/useP2P';
import { OrderListRow } from '../components/OrderListRow';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'OrdersList'>;

export function OrdersListScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const userId = useAuthStore((s) => s.user?.id);
  const [filter, setFilter] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const statusFilter = filter === '' ? undefined : filter;
  const q = useMyP2POrders(statusFilter);
  useP2PSubscriptions();

  useEffect(() => {
    analytics.screen('S-609');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(() => sortOrdersByCreatedDesc(q.data ?? []), [q.data]);
  const stats = useMemo(() => computeOrderListStats(sorted), [sorted]);

  if (q.isLoading && (q.data ?? []).length === 0) {
    return (
      <ScreenLayout testID="S-609">
        <SkeletonList rows={8} />
      </ScreenLayout>
    );
  }

  if (q.isError && (q.data ?? []).length === 0) {
    return (
      <ScreenLayout testID="S-609">
        <ErrorState title="Could not load orders" onRetry={() => void q.refetch()} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-609">
      {!isOnline ? (
        <View style={[styles.offline, { backgroundColor: `hsl(${theme.colors.statusError} / 0.08)` }]}>
          <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 13 }}>Offline — showing cached data.</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>My P2P orders</Text>
          {sorted.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}>
              <Ionicons name="list-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12 }}>
                {stats.total} orders
                {stats.inProgress > 0 ? ` · ${stats.inProgress} active` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
          Your buys and sells with other users. Open a row for payment, proof, and release — escrow until the trade completes.
        </Text>
        <Pressable onPress={() => navigation.navigate('Marketplace')} style={styles.marketLink}>
          <Ionicons name="storefront-outline" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '600' }}>Marketplace</Text>
        </Pressable>
      </View>

      <Text style={[styles.filterLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>STATUS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {ORDER_STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s || 'all'}
            label={ORDER_FILTER_LABEL[s] ?? s}
            selected={filter === s}
            onPress={() => setFilter(s)}
          />
        ))}
      </ScrollView>

      {sorted.length > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {stats.total} orders
          </Text>
          {stats.inProgress > 0 ? (
            <View style={styles.activeChip}>
              <Ionicons name="time-outline" size={12} color="#f59e0b" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>{stats.inProgress} active</Text>
            </View>
          ) : null}
          {stats.completed > 0 ? (
            <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>{stats.completed} done</Text>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        renderItem={({ item }) => (
          <OrderListRow
            order={item}
            userId={userId}
            nowMs={nowMs}
            onPress={() => navigation.navigate('OrderRoom', { orderId: item.id, order: item })}
          />
        )}
        ListEmptyComponent={
          !q.isLoading ? (
            <EmptyState
              title="No orders yet"
              message="Go to the marketplace to buy or sell. Every trade you open will show up in this list."
              actionLabel="Go to marketplace"
              onAction={() => navigation.navigate('Marketplace')}
            />
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  marketLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  filterLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  filters: { marginBottom: 12, maxHeight: 44 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8, alignItems: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list: { paddingBottom: 24 },
  offline: { borderRadius: 8, padding: 10, marginBottom: 8 },
});
