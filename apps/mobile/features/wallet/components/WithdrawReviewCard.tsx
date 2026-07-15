import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';

type Props = {
  symbol: string;
  chainName: string;
  address: string;
  memo?: string;
  amount: string;
  fee?: string;
  netAmount?: string;
};

export function WithdrawReviewCard({ symbol, chainName, address, memo, amount, fee, netAmount }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard elevated style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>REVIEW WITHDRAWAL</Text>
      <Row label="Asset" value={symbol} />
      <Row label="Network" value={chainName} />
      <Row label="Address" value={address} mono />
      {memo ? <Row label="Memo / Tag" value={memo} mono /> : null}
      <Row label="Amount" value={`${amount} ${symbol}`} />
      {fee ? <Row label="Network fee" value={`${fee} ${symbol}`} /> : null}
      {netAmount ? <Row label="You receive" value={`${netAmount} ${symbol}`} highlight /> : null}
      <View style={[styles.warn, { backgroundColor: `hsl(${theme.colors.statusWarning} / 0.1)` }]}>
        <Ionicons name="alert-circle-outline" size={16} color={`hsl(${theme.colors.statusWarning})`} />
        <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, flex: 1 }}>
          Withdrawals are irreversible. Verify address, network, and memo before submitting.
        </Text>
      </View>
    </ExchangeCard>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
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
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 11 : 14,
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
