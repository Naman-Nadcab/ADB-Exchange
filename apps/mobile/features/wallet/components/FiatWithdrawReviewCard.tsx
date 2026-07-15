import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
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
    <ExchangeCard elevated style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>REVIEW INR WITHDRAWAL</Text>
      <Row label="Amount" value={formatInr(amount)} />
      {fee != null && fee !== '' ? <Row label="Fee" value={formatInr(fee)} /> : null}
      {netAmount != null && netAmount !== '' ? (
        <Row label="You receive" value={formatInr(netAmount)} highlight />
      ) : null}
      <Row label="Destination" value={bankLabel} />
      <Row label="Method" value={methodName} />
      <View style={[styles.warn, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.8)` }]}>
        <Ionicons name="information-circle-outline" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1, lineHeight: 17 }}>
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
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary})`,
          fontWeight: highlight ? '700' : '600',
          flex: 1,
          textAlign: 'right',
          fontSize: 14,
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
