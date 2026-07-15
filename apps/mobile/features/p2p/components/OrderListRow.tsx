import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import type { P2POrder } from '@exchange/mobile-types';
import {
  counterpartyLabel,
  cryptoQtyDisplay,
  fiatTotalDisplay,
  formatOrderTimeLeft,
  hasPaymentProof,
  orderIdShort,
  orderSide,
  ORDER_STATUS_CHIP_LABEL,
  pairLabel,
  payMethodLabel,
  statusChipTone,
  unitPriceDisplay,
} from '@core/domain/p2p/ordersList';

type Props = {
  order: P2POrder;
  userId?: string | null;
  nowMs?: number;
  onPress: () => void;
};

const TONE_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.14)', text: '#f59e0b' },
  confirmed: { bg: 'rgba(59,130,246,0.14)', text: '#3b82f6' },
  done: { bg: 'rgba(14,203,129,0.14)', text: '#0ecb81' },
  muted: { bg: 'rgba(120,120,120,0.12)', text: '#888' },
  dispute: { bg: 'rgba(246,70,93,0.14)', text: '#f6465d' },
};

export function OrderListRow({ order, userId, nowMs, onPress }: Props) {
  const { theme } = useTheme();
  const side = orderSide(order, userId);
  const timeLeft = formatOrderTimeLeft(order, nowMs);
  const tone = statusChipTone(order.status);
  const colors = TONE_COLORS[tone];
  const unit = unitPriceDisplay(order);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}
    >
      <View style={[styles.icon, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}>
        <Text style={{ fontWeight: '800', color: `hsl(${theme.colors.brandPrimary})` }}>
          {(order.crypto_symbol ?? '?').slice(0, 1)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.topRow}>
          <Text style={{ fontFamily: undefined, fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>
            {orderIdShort(order.id)}
          </Text>
          {hasPaymentProof(order) ? (
            <Ionicons name="attach-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
          ) : null}
          {side ? (
            <View style={[styles.sideBadge, { backgroundColor: side === 'Buy' ? 'rgba(14,203,129,0.16)' : 'rgba(246,70,93,0.14)' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: side === 'Buy' ? '#0ecb81' : '#f6465d' }}>{side}</Text>
            </View>
          ) : null}
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
              {ORDER_STATUS_CHIP_LABEL[order.status] ?? order.status}
            </Text>
          </View>
        </View>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 4 }}>
          {cryptoQtyDisplay(order)} {order.crypto_symbol}
          <Text style={{ fontWeight: '400', color: `hsl(${theme.colors.foregroundSecondary})` }}> · </Text>
          {fiatTotalDisplay(order)}
        </Text>
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }} numberOfLines={1}>
          {pairLabel(order)} · {counterpartyLabel(order, userId)} · {payMethodLabel(order)}
          {timeLeft !== '—' ? (
            <Text style={{ fontWeight: '700', color: order.status === 'payment_pending' ? '#f59e0b' : `hsl(${theme.colors.foregroundSecondary})` }}>
              {' '}· {timeLeft}
            </Text>
          ) : null}
        </Text>
        {unit ? (
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
            Unit {unit}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sideBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
