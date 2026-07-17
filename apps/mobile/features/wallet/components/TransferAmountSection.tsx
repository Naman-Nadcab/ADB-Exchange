import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, hsl } from '@shared/theme';
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
      <View
        style={[
          styles.transferable,
          {
            padding: theme.spacing[3.5],
            borderRadius: theme.radius.lg,
            marginBottom: theme.spacing[3],
            backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`,
          },
        ]}
      >
        <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>Transferable Amount</Text>
        <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold }]}>
          {parseFloat(available || '0').toFixed(6)} {symbol}
        </Text>
      </View>

      <Text
        style={[
          theme.typography.labelSm,
          {
            color: hsl(theme.colors.foregroundSecondary),
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1.1,
            marginBottom: theme.spacing[2],
            marginTop: theme.spacing[2],
          },
        ]}
      >
        AMOUNT
      </Text>
      <View style={styles.amountRow}>
        <Pressable onPress={onMax} style={styles.maxBtn}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700' }}>MAX</Text>
        </Pressable>
      </View>

      <ExchangeCard style={styles.inputCard}>
        <Text
          style={[
            theme.typography.headingLg,
            { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold, padding: theme.spacing[1] },
          ]}
          onPress={() => {}}
        >
          {/* amount shown via parent TextField in screen */}
        </Text>
      </ExchangeCard>

      <PercentageSlider value={percent} onChange={onPercentChange} />

      {amount ? (
        <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[2] }]}>
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
      <View
        style={[
          styles.transferable,
          {
            padding: theme.spacing[3.5],
            borderRadius: theme.radius.lg,
            marginBottom: theme.spacing[3],
            backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`,
          },
        ]}
      >
        <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>Transferable Amount</Text>
        <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold }]}>
          {parseFloat(available || '0').toFixed(6)} {symbol}
        </Text>
      </View>
      <View style={styles.maxRow}>
        <PrimaryButton title="MAX" variant="secondary" onPress={onMax} />
      </View>
      <PercentageSlider value={percent} onChange={onPercentChange} />
      {amount ? (
        <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[1], marginBottom: theme.spacing[2] }]}>
          Remaining after transfer: {remaining} {symbol}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  transferable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  maxBtn: { padding: 8 },
  inputCard: { marginBottom: 8 },
  maxRow: { alignSelf: 'flex-start', marginBottom: 8 },
});
