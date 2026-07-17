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
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const warning = semanticStatusPalette(theme.colors, 'warning');
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
        <View
          style={[
            styles.offline,
            {
              backgroundColor: `hsl(${theme.colors.statusError} / 0.08)`,
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              marginBottom: theme.spacing[2],
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.statusError})` }]}>
            Offline — showing cached data.
          </Text>
        </View>
      ) : null}

      <View style={{ marginBottom: theme.spacing[3] }}>
        <View style={[styles.titleRow, { gap: theme.spacing[2] }]}>
          <Text
            style={[
              theme.typography.headingLg,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            My P2P orders
          </Text>
          {sorted.length > 0 ? (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)`,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                  gap: theme.spacing[1.5],
                },
              ]}
            >
              <Ionicons name="list-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold },
                ]}
              >
                {stats.total} orders
                {stats.inProgress > 0 ? ` · ${stats.inProgress} active` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
          ]}
        >
          Your buys and sells with other users. Open a row for payment, proof, and release — escrow until the trade completes.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Marketplace')}
          style={[styles.marketLink, { gap: theme.spacing[1.5], marginTop: theme.spacing[2.5] }]}
        >
          <Ionicons name="storefront-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Marketplace
          </Text>
        </Pressable>
      </View>

      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            marginBottom: theme.spacing[2],
          },
        ]}
      >
        STATUS
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filters, { marginBottom: theme.spacing[3] }]}>
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
        <View style={[styles.summaryRow, { gap: theme.spacing[2.5], marginBottom: theme.spacing[2] }]}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {stats.total} orders
          </Text>
          {stats.inProgress > 0 ? (
            <View style={[styles.activeChip, { gap: theme.spacing[1] }]}>
              <Ionicons name="time-outline" size={theme.sizes.iconSm} color={warning.fg} />
              <Text style={[theme.typography.bodySm, { color: warning.fg, fontFamily: theme.fonts.sansBold }]}>
                {stats.inProgress} active
              </Text>
            </View>
          ) : null}
          {stats.completed > 0 ? (
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              {stats.completed} done
            </Text>
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
        contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  countBadge: { flexDirection: 'row', alignItems: 'center' },
  marketLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  filters: { maxHeight: 44 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center' },
  offline: {},
});
