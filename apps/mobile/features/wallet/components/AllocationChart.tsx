import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { AllocationSlice } from '@core/domain/wallet/portfolio';
import { formatUsd } from '@core/domain/wallet/portfolio';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

type Props = { slices: AllocationSlice[] };

export function AllocationChart({ slices }: Props) {
  const { theme } = useTheme();
  const top = slices.slice(0, 6);

  if (!top.length) {
    return (
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
        No allocation data
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Asset Allocation
      </Text>
      {top.map((s, i) => (
        <View key={s.symbol} style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
              {s.symbol}
            </Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
              {s.pct.toFixed(1)}% · ${formatUsd(s.usdValue)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]}>
            <View
              style={[styles.fill, { width: `${Math.min(100, s.pct)}%`, backgroundColor: COLORS[i % COLORS.length] }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  row: { marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
