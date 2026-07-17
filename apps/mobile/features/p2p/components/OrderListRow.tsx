import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
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

const ORDER_CHIP_TONE: Record<ReturnType<typeof statusChipTone>, StatusChipTone> = {
  pending: 'warn',
  confirmed: 'sync',
  done: 'live',
  dispute: 'off',
  muted: 'neutral',
};

export function OrderListRow({ order, userId, nowMs, onPress }: Props) {
  const { theme } = useTheme();
  const side = orderSide(order, userId);
  const timeLeft = formatOrderTimeLeft(order, nowMs);
  const chipTone = ORDER_CHIP_TONE[statusChipTone(order.status)];
  const unit = unitPriceDisplay(order);
  const buyPalette = semanticStatusPalette(theme.colors, 'buy');
  const sellPalette = semanticStatusPalette(theme.colors, 'sell');
  const warnPalette = semanticStatusPalette(theme.colors, 'warning');
  const sidePalette = side === 'Buy' ? buyPalette : sellPalette;

  return (
    <Pressable onPress={onPress}>
      <ExchangeCard
        style={{
          marginBottom: theme.spacing[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          minHeight: theme.listDensity.asset.rowHeight,
        }}
      >
        <View
          style={[
            styles.icon,
            {
              width: theme.sizes.tapTarget,
              height: theme.sizes.tapTarget,
              borderRadius: theme.radius.full,
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)`,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelMd,
              { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {(order.crypto_symbol ?? '?').slice(0, 1)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.topRow, { gap: theme.spacing[1.5] }]}>
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono },
              ]}
            >
              {orderIdShort(order.id)}
            </Text>
            {hasPaymentProof(order) ? (
              <Ionicons name="attach-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
            ) : null}
            {side ? (
              <View
                style={[
                  styles.sideBadge,
                  {
                    borderRadius: theme.radius.sm,
                    paddingHorizontal: theme.spacing[1.5],
                    paddingVertical: theme.spacing[0.5],
                    backgroundColor: sidePalette.bg,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.labelSm,
                    { color: sidePalette.fg, fontFamily: theme.fonts.sansBold },
                  ]}
                >
                  {side}
                </Text>
              </View>
            ) : null}
            <StatusChip label={ORDER_STATUS_CHIP_LABEL[order.status] ?? order.status} tone={chipTone} />
          </View>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                marginTop: theme.spacing[1],
              },
            ]}
          >
            {cryptoQtyDisplay(order)} {order.crypto_symbol}
            <Text style={{ fontFamily: theme.fonts.sans, color: `hsl(${theme.colors.foregroundSecondary})` }}>
              {' '}
              ·{' '}
            </Text>
            {fiatTotalDisplay(order)}
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
            numberOfLines={1}
          >
            {pairLabel(order)} · {counterpartyLabel(order, userId)} · {payMethodLabel(order)}
            {timeLeft !== '—' ? (
              <Text
                style={{
                  fontFamily: theme.fonts.sansBold,
                  color:
                    order.status === 'payment_pending'
                      ? warnPalette.fg
                      : `hsl(${theme.colors.foregroundSecondary})`,
                }}
              >
                {' '}
                · {timeLeft}
              </Text>
            ) : null}
          </Text>
          {unit ? (
            <Text
              style={[
                theme.typography.labelSm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              Unit {unit}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </ExchangeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  sideBadge: {},
});
