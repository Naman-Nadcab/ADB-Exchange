import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';

type Props = {
  symbol: string;
  chainName: string;
  address: string;
  memo?: string;
  amount: string;
  fee?: string;
  netAmount?: string;
  arrivalHint?: string;
};

export function WithdrawReviewCard({ symbol, chainName, address, memo, amount, fee, netAmount, arrivalHint }: Props) {
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
        REVIEW WITHDRAWAL
      </Text>
      <Row label="Asset" value={symbol} />
      <Row label="Network" value={chainName} />
      <Row label="Address" value={address} mono />
      {memo ? <Row label="Memo / Tag" value={memo} mono /> : null}
      <Row label="Amount" value={`${amount} ${symbol}`} />
      {fee ? <Row label="Network fee" value={`${fee} ${symbol}`} /> : null}
      {netAmount ? <Row label="You receive" value={`${netAmount} ${symbol}`} highlight /> : null}
      {arrivalHint ? <Row label="Est. arrival" value={arrivalHint} /> : null}
      <View
        style={[
          styles.warn,
          {
            gap: theme.spacing[2],
            padding: theme.spacing[2.5],
            borderRadius: theme.radius.md,
            marginTop: theme.spacing[2.5],
            backgroundColor: hsl(`${theme.colors.statusWarning} / 0.1`),
          },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={theme.sizes.iconSm} color={hsl(theme.colors.statusWarning)} />
        <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.statusWarning), flex: 1 }]}>
          Withdrawals are irreversible. Verify address, network, and memo before submitting.
        </Text>
      </View>
    </ExchangeCard>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing[3], paddingVertical: theme.spacing[1.5] }]}>
      <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>{label}</Text>
      <Text
        style={[
          mono ? theme.typography.labelMd : theme.typography.bodyMd,
          {
            color: hsl(highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary),
            fontFamily: highlight ? theme.fonts.sansBold : mono ? theme.fonts.mono : theme.fonts.sansSemiBold,
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
