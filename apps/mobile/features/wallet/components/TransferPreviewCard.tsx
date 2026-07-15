import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
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
  const receive = amount && parseFloat(amount) > 0 ? parseFloat(amount).toFixed(6) : '0.00';

  return (
    <ExchangeCard elevated style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>TRANSFER PREVIEW</Text>
      <Row label="From" value={transferAccountLabel(fromAccount)} />
      <Row label="To" value={transferAccountLabel(toAccount)} />
      <Row label="Amount" value={`${amount || '0'} ${symbol}`} />
      <Row label="Transfer fee" value="Free" highlight={true} />
      <Row label="You will receive" value={`${receive} ${symbol}`} />
      <Row label="Est. arrival" value="Instant" />
      <View style={[styles.warn, { backgroundColor: `hsl(${theme.colors.statusInfo} / 0.1)` }]}>
        <Ionicons name="information-circle-outline" size={16} color={`hsl(${theme.colors.statusInfo})`} />
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1 }}>
          Internal transfers are instant with no network fees. Balances update immediately after confirmation.
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
          fontWeight: '600',
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
