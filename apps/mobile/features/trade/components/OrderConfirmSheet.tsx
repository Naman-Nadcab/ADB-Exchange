import { View, Text } from 'react-native';
import { BottomSheet, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { OrderSide, PlaceOrderRequest } from '@exchange/mobile-types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  order: PlaceOrderRequest;
  quoteAsset: string;
  baseAsset: string;
  estimate?: string | null;
  fee?: string;
};

export function OrderConfirmSheet({
  visible,
  onClose,
  onConfirm,
  loading,
  order,
  quoteAsset,
  baseAsset,
  estimate,
  fee,
}: Props) {
  const { theme } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Confirm Order">
      <SummaryRow label="Pair" value={`${baseAsset}/${quoteAsset}`} theme={theme} />
      <SummaryRow label="Side" value={order.side.toUpperCase()} theme={theme} highlight={order.side} />
      <SummaryRow label="Type" value={order.type.replace(/_/g, ' ')} theme={theme} />
      <SummaryRow label="Quantity" value={`${order.quantity} ${baseAsset}`} theme={theme} />
      {order.price ? <SummaryRow label="Price" value={order.price} theme={theme} /> : null}
      {order.stop_price ? <SummaryRow label="Stop" value={order.stop_price} theme={theme} /> : null}
      {estimate ? <SummaryRow label="Est. total" value={`${estimate} ${quoteAsset}`} theme={theme} /> : null}
      {fee ? <SummaryRow label="Est. fee" value={fee} theme={theme} /> : null}
      <PrimaryButton
        title={order.side === 'buy' ? `Confirm Buy ${baseAsset}` : `Confirm Sell ${baseAsset}`}
        loading={loading}
        onPress={onConfirm}
        style={{ marginTop: theme.spacing[4] }}
      />
    </BottomSheet>
  );
}

function SummaryRow({
  label,
  value,
  theme,
  highlight,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  highlight?: OrderSide;
}) {
  const color =
    highlight === 'buy'
      ? theme.colors.tradeBuy
      : highlight === 'sell'
        ? theme.colors.tradeSell
        : theme.colors.foregroundPrimary;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${color})`, fontFamily: theme.fonts.monoSemiBold, textTransform: highlight ? 'capitalize' : 'none' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
