import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { transferAccountLabel } from '@core/domain/wallet/transfer';
import { formatRateDisplay } from '@core/domain/wallet/convert';

type Props = {
  accountType: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee?: string;
};

export function ConvertPreviewCard({ accountType, fromSymbol, toSymbol, fromAmount, toAmount, rate, fee }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard elevated style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>REVIEW CONVERSION</Text>
      <Row label="Account" value={transferAccountLabel(accountType)} />
      <Row label="You pay" value={`${fromAmount} ${fromSymbol}`} />
      <Row label="You receive" value={`${toAmount} ${toSymbol}`} highlight />
      <Row label="Rate" value={formatRateDisplay(fromSymbol, toSymbol, rate)} />
      <Row label="Fee" value={fee === '0' || !fee ? 'Free' : fee} highlight={!fee || fee === '0'} />
      <Row label="Est. arrival" value="Instant" />
      <View style={[styles.warn, { backgroundColor: `hsl(${theme.colors.statusInfo} / 0.1)` }]}>
        <Ionicons name="information-circle-outline" size={16} color={`hsl(${theme.colors.statusInfo})`} />
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1 }}>
          Rates are locked until the quote expires. Confirm before the timer runs out.
        </Text>
      </View>
    </ExchangeCard>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary})`,
          fontWeight: highlight ? '700' : '600',
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  warn: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'flex-start' },
});
