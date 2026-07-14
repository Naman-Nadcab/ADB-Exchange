import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
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
    <TerminalPanel style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
          Open Orders ({orders.length})
        </Text>
        <View style={styles.headerActions}>
          {orders.length > 1 ? (
            <Pressable
              onPress={() => {
                void hapticLight();
                cancelAll.mutate(symbol);
              }}
              accessibilityLabel="Cancel all orders"
            >
              <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12, fontWeight: '600' }}>Cancel all</Text>
            </Pressable>
          ) : null}
          {onViewAll ? (
            <Pressable onPress={onViewAll}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>View all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {peek.map((o) => {
        const sideColor = o.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
        return (
          <View key={o.id} style={styles.row}>
            <Text style={{ color: `hsl(${sideColor})`, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
              {o.side} {o.type}
            </Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1, marginHorizontal: 8 }}>
              {o.quantity} @ {o.price ?? 'MKT'}
            </Text>
            <Pressable onPress={() => cancel.mutate(o.id)} accessibilityLabel="Cancel order">
              <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </View>
        );
      })}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, minHeight: 28 },
});
