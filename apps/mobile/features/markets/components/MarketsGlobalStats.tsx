import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { marketing } from '@shared/theme/marketing';
import { formatVolume, formatMarketCap } from '@core/domain/markets/formatPrice';

type Props = {
  pairsCount: number;
  totalVolume: number;
  gainers: number;
  losers: number;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
  globalMarketCap?: number;
  btcDominance?: number;
  intelligenceVolume?: number;
  bullishPct?: number;
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
      <Text style={[styles.value, { color: '#FFFFFF' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function MarketsGlobalStats({
  pairsCount,
  totalVolume,
  gainers,
  losers,
  fearGreedIndex,
  fearGreedLabel,
  globalMarketCap,
  btcDominance,
  intelligenceVolume,
  bullishPct,
}: Props) {
  const vol = intelligenceVolume && intelligenceVolume > 0 ? intelligenceVolume : totalVolume;
  return (
    <View style={styles.grid}>
      {globalMarketCap != null && globalMarketCap > 0 ? (
        <HeroMetric label="Global MCap" value={formatMarketCap(globalMarketCap)} icon="globe-outline" />
      ) : null}
      <HeroMetric label="24H Volume" value={formatVolume(vol)} icon="pulse-outline" />
      {btcDominance != null ? (
        <HeroMetric label="BTC Dominance" value={`${btcDominance.toFixed(1)}%`} icon="logo-bitcoin" />
      ) : null}
      {fearGreedIndex != null ? (
        <HeroMetric
          label="Fear & Greed"
          value={`${fearGreedIndex}${fearGreedLabel ? ` · ${fearGreedLabel}` : ''}`}
          icon="speedometer-outline"
          accent={fearGreedIndex >= 55 ? '#34D399' : fearGreedIndex <= 45 ? '#FB7185' : marketing.gold}
        />
      ) : null}
      <HeroMetric label="Pairs" value={String(pairsCount)} icon="grid-outline" />
      <HeroMetric label="Gainers" value={String(gainers)} accent="#34D399" icon="arrow-up" />
      <HeroMetric label="Losers" value={String(losers)} accent="#FB7185" icon="arrow-down" />
      {bullishPct != null ? (
        <HeroMetric label="Market Pulse" value={`${bullishPct}% bullish`} icon="analytics-outline" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metric: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 72,
  },
  icon: { marginBottom: 6 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
