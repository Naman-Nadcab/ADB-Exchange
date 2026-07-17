import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { ExchangeCard } from '@shared/ui';
import { transferAccountLabel } from '@core/domain/wallet/transfer';

type Props = {
  fromAccount: string;
  toAccount: string;
  symbol: string;
  amount: string;
};

export function TransferPreviewCard({ fromAccount, toAccount, symbol, amount }: Props) {
  const { theme } = useTheme();
  const info = semanticStatusPalette(theme.colors, 'info');
  const receive = amount && parseFloat(amount) > 0 ? parseFloat(amount).toFixed(6) : '0.00';

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
        TRANSFER PREVIEW
      </Text>
      <Row label="From" value={transferAccountLabel(fromAccount)} />
      <Row label="To" value={transferAccountLabel(toAccount)} />
      <Row label="Amount" value={`${amount || '0'} ${symbol}`} />
      <Row label="Transfer fee" value="Free" highlight={true} />
      <Row label="You will receive" value={`${receive} ${symbol}`} />
      <Row label="Est. arrival" value="Instant" />
      <View
        style={[
          styles.warn,
          {
            backgroundColor: info.bg,
            gap: theme.spacing[2],
            padding: theme.spacing[2.5],
            borderRadius: theme.radius.md,
            marginTop: theme.spacing[2.5],
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={theme.sizes.iconXs} color={info.fg} />
        <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary), flex: 1 }]}>
          Internal transfers are instant with no network fees. Balances update immediately after confirmation.
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
            fontFamily: theme.fonts.sansSemiBold,
            color: hsl(highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary),
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
