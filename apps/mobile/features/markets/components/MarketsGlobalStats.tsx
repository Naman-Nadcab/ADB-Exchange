import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
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
  const { theme } = useTheme();
  const m = theme.marketing;

  return (
    <ExchangeCard variant="marketing" style={styles.metric}>
      {icon ? (
        <Ionicons
          name={icon}
          size={theme.sizes.iconSm - 6}
          color={accent ?? m.gold}
          style={{ marginBottom: theme.spacing[1.5] }}
        />
      ) : null}
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: m.mutedText,
            fontFamily: theme.fonts.sansSemiBold,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            marginBottom: theme.spacing[1],
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          theme.typography.bodyLg,
          { color: '#FFFFFF', fontFamily: theme.fonts.sansBold, fontVariant: ['tabular-nums'] },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </ExchangeCard>
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
  const { theme } = useTheme();
  const buy = hsl(theme.colors.tradeBuy);
  const sell = hsl(theme.colors.tradeSell);
  const vol = intelligenceVolume && intelligenceVolume > 0 ? intelligenceVolume : totalVolume;

  return (
    <View style={[styles.grid, { gap: theme.spacing[2], marginBottom: theme.spacing[3.5] }]}>
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
          accent={fearGreedIndex >= 55 ? buy : fearGreedIndex <= 45 ? sell : theme.marketing.gold}
        />
      ) : null}
      <HeroMetric label="Pairs" value={String(pairsCount)} icon="grid-outline" />
      <HeroMetric label="Gainers" value={String(gainers)} accent={buy} icon="arrow-up" />
      <HeroMetric label="Losers" value={String(losers)} accent={sell} icon="arrow-down" />
      {bullishPct != null ? (
        <HeroMetric label="Market Pulse" value={`${bullishPct}% bullish`} icon="analytics-outline" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 72,
  },
});
