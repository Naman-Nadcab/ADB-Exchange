import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { formatInr } from '@core/domain/wallet/fiat';

type Props = {
  amount: string;
  bankLabel: string;
  methodName: string;
  fee?: string;
  netAmount?: string;
};

export function FiatWithdrawReviewCard({ amount, bankLabel, methodName, fee, netAmount }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5] }}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: hsl(theme.colors.foregroundSecondary),
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1.1,
            marginBottom: theme.spacing[2.5],
          },
        ]}
      >
        REVIEW INR WITHDRAWAL
      </Text>
      <Row label="Amount" value={formatInr(amount)} />
      {fee != null && fee !== '' ? <Row label="Fee" value={formatInr(fee)} /> : null}
      {netAmount != null && netAmount !== '' ? (
        <Row label="You receive" value={formatInr(netAmount)} highlight />
      ) : null}
      <Row label="Destination" value={bankLabel} />
      <Row label="Method" value={methodName} />
      <View
        style={[
          styles.warn,
          {
            gap: theme.spacing[2],
            padding: theme.spacing[2.5],
            borderRadius: theme.radius.md,
            marginTop: theme.spacing[2.5],
            backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.8)`,
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundSecondary)} />
        <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary), flex: 1, lineHeight: 17 }]}>
          Your INR balance is funded from P2P sells / team credit. Requests are reviewed and the bank transfer is
          settled manually before completion. You can cancel while a request is still pending.
        </Text>
      </View>
    </ExchangeCard>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing[3], paddingVertical: theme.spacing[1.5] }]}>
      <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>{label}</Text>
      <Text
        style={[
          theme.typography.bodyMd,
          {
            color: hsl(highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary),
            fontFamily: highlight ? theme.fonts.sansBold : theme.fonts.sansSemiBold,
            flex: 1,
            textAlign: 'right',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  warn: { flexDirection: 'row', alignItems: 'flex-start' },
});
