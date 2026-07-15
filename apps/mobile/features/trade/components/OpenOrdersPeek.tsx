import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, showToast } from '@shared/ui';
import { ApiError } from '@core/api/errors/ApiError';
import type { SpotOrder } from '@exchange/mobile-types';
import { useCancelOrder, useCancelAllOrders } from '../hooks/useTrade';

type Props = { orders: SpotOrder[]; symbol: string; onViewAll?: () => void };

function orderLabel(o: SpotOrder): string {
  const filled = parseFloat(o.filled_quantity);
  const total = parseFloat(o.quantity);
  const partial = Number.isFinite(filled) && filled > 0 && filled < total;
  const price = o.price ?? (o.type.includes('market') || o.type.includes('trailing') ? 'MKT' : '—');
  const base = `${o.quantity} @ ${price}`;
  if (partial) return `${base} (${o.filled_quantity} filled)`;
  return base;
}

export function OpenOrdersPeek({ orders, symbol, onViewAll }: Props) {
  const { theme } = useTheme();
  const cancel = useCancelOrder();
  const cancelAll = useCancelAllOrders();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const peek = orders.slice(0, 3);

  const handleCancel = (orderId: string) => {
    setCancellingId(orderId);
    cancel.mutate(orderId, {
      onSuccess: () => showToast('Order cancelled', { tone: 'success' }),
      onError: (err) =>
        showToast('Cancel failed', {
          message: err instanceof ApiError ? err.message : 'Could not cancel order',
          tone: 'error',
        }),
      onSettled: () => setCancellingId(null),
    });
  };

  const handleCancelAll = () => {
    cancelAll.mutate(symbol, {
      onSuccess: () => showToast('All orders cancelled', { tone: 'success' }),
      onError: (err) =>
        showToast('Cancel all failed', {
          message: err instanceof ApiError ? err.message : 'Could not cancel orders',
          tone: 'error',
        }),
    });
  };

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
                if (!cancelAll.isPending) handleCancelAll();
              }}
              disabled={cancelAll.isPending}
              accessibilityLabel="Cancel all orders"
            >
              {cancelAll.isPending ? (
                <ActivityIndicator size="small" color={`hsl(${theme.colors.statusError})`} />
              ) : (
                <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12, fontWeight: '600' }}>Cancel all</Text>
              )}
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
        const busy = cancellingId === o.id && cancel.isPending;
        return (
          <View key={o.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: `hsl(${sideColor})`, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                {o.side} {o.type.replace(/_/g, ' ')}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 2 }}>
                {orderLabel(o)}
                {o.displayStatus || o.status ? ` · ${o.displayStatus ?? o.status}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!busy) handleCancel(o.id);
              }}
              disabled={busy}
              accessibilityLabel="Cancel order"
              style={{ minWidth: 52, alignItems: 'flex-end' }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={`hsl(${theme.colors.statusError})`} />
              ) : (
                <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12 }}>Cancel</Text>
              )}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, minHeight: 36 },
});
