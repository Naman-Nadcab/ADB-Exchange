import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { P2PDispute } from '@exchange/mobile-types';
import {
  formatOrderStatusDisplay,
  orderFiatDisplay,
  orderIdShort,
  orderQtyDisplay,
} from '@core/domain/p2p/dispute';

type Props = {
  dispute: P2PDispute;
  onOrderPress: () => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

export function DisputeSummaryCard({ dispute, onOrderPress }: Props) {
  const { theme } = useTheme();
  const fiat = orderFiatDisplay(dispute);
  const qty = orderQtyDisplay(dispute);

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Row label="Order">
        <Pressable onPress={onOrderPress}>
          <Text style={{ fontFamily: undefined, fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.brandPrimary})` }}>
            {orderIdShort(dispute.order_id)}
          </Text>
        </Pressable>
      </Row>
      {dispute.order_status ? (
        <Row label="Order Status">
          <Text style={{ fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})`, textTransform: 'capitalize' }}>
            {formatOrderStatusDisplay(dispute.order_status)}
          </Text>
        </Row>
      ) : null}
      {fiat ? (
        <Row label="Fiat Amount">
          <Text style={{ fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>{fiat}</Text>
        </Row>
      ) : null}
      {qty ? (
        <Row label="Quantity">
          <Text style={{ fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>{qty}</Text>
        </Row>
      ) : null}
      {dispute.reason ? (
        <View style={styles.reasonBlock}>
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 4 }}>Your Reason</Text>
          <Text style={{ fontSize: 14, color: `hsl(${theme.colors.foregroundPrimary})`, lineHeight: 20 }}>{dispute.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  reasonBlock: { paddingHorizontal: 16, paddingVertical: 12 },
});
