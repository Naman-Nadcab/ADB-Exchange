import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatVolume } from '@core/domain/markets/formatPrice';

type Props = {
  pairsCount: number;
  totalVolume: number;
  gainers: number;
  losers: number;
};

function Metric({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.metric,
        {
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          borderColor: `hsl(${theme.colors.brandPrimary} / 0.15)`,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text style={[styles.value, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{value}</Text>
    </View>
  );
}

export function MarketsMetricsRow({ pairsCount, totalVolume, gainers, losers }: Props) {
  return (
    <View style={styles.row}>
      <Metric label="Pairs" value={String(pairsCount)} />
      <Metric label="24H Vol" value={formatVolume(totalVolume)} />
      <Metric label="↑ Gainers" value={String(gainers)} />
      <Metric label="↓ Losers" value={String(losers)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 12,
    borderWidth: 1,
    minHeight: 64,
  },
  label: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
