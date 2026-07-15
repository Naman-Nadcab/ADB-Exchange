import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { marketing } from '@shared/theme/marketing';
import { formatVolume } from '@core/domain/markets/formatPrice';

type Props = {
  pairsCount: number;
  totalVolume: number;
  gainers: number;
  losers: number;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
};

function HeroMetric({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.metric, { borderColor: marketing.goldBorder, backgroundColor: marketing.cardBg }]}>
      {icon ? (
        <Ionicons name={icon} size={14} color={accent ?? marketing.gold} style={styles.icon} />
      ) : null}
      <Text style={[styles.label, { color: marketing.mutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: '#FFFFFF' }]}>{value}</Text>
    </View>
  );
}

export function MarketsMetricsRow({
  pairsCount,
  totalVolume,
  gainers,
  losers,
  fearGreedIndex,
  fearGreedLabel,
}: Props) {
  return (
    <View style={styles.grid}>
      <HeroMetric label="Pairs" value={String(pairsCount)} icon="grid-outline" />
      <HeroMetric label="24H Volume" value={formatVolume(totalVolume)} icon="pulse-outline" />
      <HeroMetric label="Gainers" value={String(gainers)} accent="#34D399" icon="arrow-up" />
      <HeroMetric label="Losers" value={String(losers)} accent="#FB7185" icon="arrow-down" />
      {fearGreedIndex != null ? (
        <HeroMetric
          label="Fear & Greed"
          value={String(fearGreedIndex)}
          icon="speedometer-outline"
          accent={fearGreedIndex >= 55 ? '#34D399' : fearGreedIndex <= 45 ? '#FB7185' : marketing.gold}
        />
      ) : null}
      {fearGreedLabel ? (
        <HeroMetric label="Sentiment" value={fearGreedLabel} icon="analytics-outline" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: { marginBottom: 6 },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
