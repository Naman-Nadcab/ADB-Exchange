import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { SpotOrder } from '@exchange/mobile-types';
import { useCancelOrder, useCancelAllOrders } from '../hooks/useTrade';

type Props = { orders: SpotOrder[]; symbol: string; onViewAll?: () => void };

export function OpenOrdersPeek({ orders, symbol, onViewAll }: Props) {
  const { theme } = useTheme();
  const cancel = useCancelOrder();
  const cancelAll = useCancelAllOrders();
  const peek = orders.slice(0, 3);

  if (!peek.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
          Open Orders ({orders.length})
        </Text>
        <View style={styles.headerActions}>
          {orders.length > 1 ? (
            <Pressable
              onPress={() => cancelAll.mutate(symbol)}
              accessibilityLabel="Cancel all orders"
            >
              <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12 }}>Cancel all</Text>
            </Pressable>
          ) : null}
          {onViewAll ? (
            <Pressable onPress={onViewAll}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>View all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {peek.map((o) => (
        <View key={o.id} style={styles.row}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {o.side} {o.type} {o.quantity} @ {o.price ?? 'MKT'}
          </Text>
          <Pressable onPress={() => cancel.mutate(o.id)} accessibilityLabel="Cancel order">
            <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12 }}>Cancel</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, padding: 12, borderRadius: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
