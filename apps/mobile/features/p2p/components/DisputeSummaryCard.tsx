import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ExchangeCard } from '@shared/ui';
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
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
          borderBottomColor: `hsl(${theme.colors.borderDefault})`,
        },
      ]}
    >
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

export function DisputeSummaryCard({ dispute, onOrderPress }: Props) {
  const { theme } = useTheme();
  const fiat = orderFiatDisplay(dispute);
  const qty = orderQtyDisplay(dispute);

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden' }}>
      <Row label="Order">
        <Pressable onPress={onOrderPress}>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: `hsl(${theme.colors.brandPrimary})`,
                fontFamily: theme.fonts.monoSemiBold,
              },
            ]}
          >
            {orderIdShort(dispute.order_id)}
          </Text>
        </Pressable>
      </Row>
      {dispute.order_status ? (
        <Row label="Order Status">
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'capitalize',
              },
            ]}
          >
            {formatOrderStatusDisplay(dispute.order_status)}
          </Text>
        </Row>
      ) : null}
      {fiat ? (
        <Row label="Fiat Amount">
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {fiat}
          </Text>
        </Row>
      ) : null}
      {qty ? (
        <Row label="Quantity">
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {qty}
          </Text>
        </Row>
      ) : null}
      {dispute.reason ? (
        <View style={{ paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[3] }}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[1] },
            ]}
          >
            Your Reason
          </Text>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {dispute.reason}
          </Text>
        </View>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
