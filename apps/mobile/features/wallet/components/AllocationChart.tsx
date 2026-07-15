import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type ThemeTokens } from '@shared/theme';
import type { AllocationSlice } from '@core/domain/wallet/portfolio';
import { formatUsd } from '@core/domain/wallet/portfolio';
import { ExchangeCard } from '@shared/ui';

type Props = { slices: AllocationSlice[] };

const SLICE_COLORS = (theme: ThemeTokens) => [
  `hsl(${theme.colors.brandPrimary})`,
  `hsl(${theme.colors.tradeBuy})`,
  `hsl(${theme.colors.statusInfo})`,
  `hsl(${theme.colors.tradeSell})`,
  `hsl(${theme.colors.statusWarning})`,
  `hsl(${theme.colors.foregroundSecondary})`,
];

export function AllocationChart({ slices }: Props) {
  const { theme } = useTheme();
  const top = slices.slice(0, 6);
  const colors = SLICE_COLORS(theme);

  if (!top.length) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
          No allocation data yet
        </Text>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        ASSET ALLOCATION
      </Text>
      {top.map((s, i) => (
        <View key={s.symbol} style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
              {s.symbol}
            </Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
              {s.pct.toFixed(1)}% · ${formatUsd(s.usdValue)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]}>
            <View
              style={[styles.fill, { width: `${Math.min(100, s.pct)}%`, backgroundColor: colors[i % colors.length] }]}
            />
          </View>
        </View>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  row: { marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
