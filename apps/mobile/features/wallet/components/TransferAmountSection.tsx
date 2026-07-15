import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard, PrimaryButton } from '@shared/ui';
import { PercentageSlider } from '@shared/ui/trading/PercentageSlider';
import { computeRemainingBalance } from '@core/domain/wallet/transfer';

type Props = {
  symbol: string;
  available: string;
  amount: string;
  onAmountChange: (v: string) => void;
  onMax: () => void;
  percent: number;
  onPercentChange: (pct: number) => void;
};

export function TransferAmountSection({
  symbol,
  available,
  amount,
  onAmountChange,
  onMax,
  percent,
  onPercentChange,
}: Props) {
  const { theme } = useTheme();
  const remaining = computeRemainingBalance(available, amount);

  return (
    <View style={styles.wrap}>
      <View style={[styles.transferable, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>Transferable Amount</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
          {parseFloat(available || '0').toFixed(6)} {symbol}
        </Text>
      </View>

      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>AMOUNT</Text>
      <View style={styles.amountRow}>
        <Pressable onPress={onMax} style={styles.maxBtn}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700' }}>MAX</Text>
        </Pressable>
      </View>

      <ExchangeCard style={styles.inputCard}>
        <Text
          style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 22, fontWeight: '700', padding: 4 }}
          onPress={() => {}}
        >
          {/* amount shown via parent TextField in screen */}
        </Text>
      </ExchangeCard>

      <PercentageSlider value={percent} onChange={onPercentChange} />

      {amount ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 8 }}>
          Remaining after transfer: {remaining} {symbol}
        </Text>
      ) : null}
    </View>
  );
}

/** Compact amount controls used inside TransferScreen with TextField */
export function TransferAmountControls({
  symbol,
  available,
  amount,
  onMax,
  percent,
  onPercentChange,
}: Omit<Props, 'onAmountChange'>) {
  const { theme } = useTheme();
  const remaining = computeRemainingBalance(available, amount);

  return (
    <>
      <View style={[styles.transferable, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>Transferable Amount</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
          {parseFloat(available || '0').toFixed(6)} {symbol}
        </Text>
      </View>
      <View style={styles.maxRow}>
        <PrimaryButton title="MAX" variant="secondary" onPress={onMax} />
      </View>
      <PercentageSlider value={percent} onChange={onPercentChange} />
      {amount ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
          Remaining after transfer: {remaining} {symbol}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8, marginTop: 8 },
  transferable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 12 },
  amountRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  maxBtn: { padding: 8 },
  inputCard: { marginBottom: 8 },
  maxRow: { alignSelf: 'flex-start', marginBottom: 8 },
});
