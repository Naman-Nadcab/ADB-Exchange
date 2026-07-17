import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
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
  const { theme } = useTheme();
  const m = theme.marketing;

  return (
    <ExchangeCard variant="marketing" elevated style={styles.metric}>
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
          theme.typography.headingMd,
          { color: '#FFFFFF', fontFamily: theme.fonts.sansBold, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
    </ExchangeCard>
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
  const { theme } = useTheme();
  const buy = hsl(theme.colors.tradeBuy);
  const sell = hsl(theme.colors.tradeSell);

  return (
    <View style={[styles.grid, { gap: theme.spacing[2], marginBottom: theme.spacing[3.5] }]}>
      <HeroMetric label="Pairs" value={String(pairsCount)} icon="grid-outline" />
      <HeroMetric label="24H Volume" value={formatVolume(totalVolume)} icon="pulse-outline" />
      <HeroMetric label="Gainers" value={String(gainers)} accent={buy} icon="arrow-up" />
      <HeroMetric label="Losers" value={String(losers)} accent={sell} icon="arrow-down" />
      {fearGreedIndex != null ? (
        <HeroMetric
          label="Fear & Greed"
          value={String(fearGreedIndex)}
          icon="speedometer-outline"
          accent={fearGreedIndex >= 55 ? buy : fearGreedIndex <= 45 ? sell : theme.marketing.gold}
        />
      ) : null}
      {fearGreedLabel ? (
        <HeroMetric label="Sentiment" value={fearGreedLabel} icon="analytics-outline" />
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
