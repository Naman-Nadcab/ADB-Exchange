import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, StatusChip, showToast } from '@shared/ui';
import { ApiError } from '@core/api/errors/ApiError';
import type { SpotOrder } from '@exchange/mobile-types';
import { useCancelOrder } from '../hooks/useTrade';

type Props = {
  order: SpotOrder;
};

export function SpotOpenOrderRow({ order }: Props) {
  const { theme } = useTheme();
  const cancel = useCancelOrder();
  const [busy, setBusy] = useState(false);
  const sideColor = order.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;

  return (
    <TerminalPanel subtle style={styles.row}>
      <View style={styles.header}>
        <View style={styles.left}>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${sideColor})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'capitalize' }]}>
            {order.side} {order.type.replace(/_/g, ' ')}
          </Text>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
            {order.market}
          </Text>
        </View>
        <StatusChip label={order.displayStatus ?? order.status} tone="sync" />
      </View>
      <View style={styles.details}>
        <Text style={[theme.typography.price, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono }]}>
          {order.quantity} @ {order.price ?? 'MKT'}
        </Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Filled {order.filled_quantity}/{order.quantity}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          if (busy) return;
          void hapticLight();
          setBusy(true);
          cancel.mutate(order.id, {
            onSuccess: () => showToast('Order cancelled', { tone: 'success' }),
            onError: (err) =>
              showToast('Cancel failed', {
                message: err instanceof ApiError ? err.message : 'Could not cancel order',
                tone: 'error',
              }),
            onSettled: () => setBusy(false),
          });
        }}
        disabled={busy}
        accessibilityLabel="Cancel order"
        style={styles.cancelBtn}
      >
        {busy ? (
          <ActivityIndicator size="small" color={`hsl(${theme.colors.statusError})`} />
        ) : (
          <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
        )}
      </Pressable>
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { flex: 1 },
  details: { marginTop: 8 },
  cancelBtn: { marginTop: 8, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
});
