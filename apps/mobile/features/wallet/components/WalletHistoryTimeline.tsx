import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { WalletHistoryTimelineStep } from '@core/domain/wallet/walletHistory';

type Props = {
  steps: WalletHistoryTimelineStep[];
};

export function WalletHistoryTimeline({ steps }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Timeline</Text>
      {steps.map((step, idx) => {
        const color =
          step.state === 'done'
            ? theme.colors.tradeBuy
            : step.state === 'active'
              ? theme.colors.statusWarning
              : step.state === 'failed'
                ? theme.colors.tradeSell
                : theme.colors.foregroundSecondary;
        return (
          <View key={step.id} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: `hsl(${color})` }]} />
              {idx < steps.length - 1 ? (
                <View style={[styles.line, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: idx < steps.length - 1 ? 12 : 0 }}>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{step.label}</Text>
              {step.timestamp ? (
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                  {new Date(step.timestamp).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  step: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 2 },
});
