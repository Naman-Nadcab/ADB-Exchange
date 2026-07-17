import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { hapticLight, useTheme, hsl, hslAlpha } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { formatChangePct, formatVolume, formatMarketCap, changeColorKey } from '@core/domain/markets/formatPrice';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  rows: MarketListItem[];
  onSelect: (symbol: string) => void;
};

export function MarketsHeatmapSection({ rows, onSelect }: Props) {
  const { theme } = useTheme();
  const m = theme.marketing;
  const buy = hsl(theme.colors.tradeBuy);
  const sell = hsl(theme.colors.tradeSell);

  if (!rows.length) return null;
  const maxCap = Math.max(...rows.map((r) => r.marketCap ?? 0), 1);

  return (
    <ExchangeCard variant="marketing" style={{ marginBottom: theme.spacing[3.5], maxHeight: 280 }}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: m.gold,
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: theme.spacing[2.5],
          },
        ]}
      >
        Market Heatmap
      </Text>
      <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {rows.map((row, idx) => {
          const bullish = row.changePct >= 0;
          const color = changeColorKey(row.changePct) === 'buy' ? buy : sell;
          const capShare = Math.max(20, Math.min(100, ((row.marketCap ?? 0) / maxCap) * 100));
          return (
            <Pressable
              key={row.symbol}
              onPress={() => {
                void hapticLight();
                onSelect(row.symbol);
              }}
              style={[
                styles.ribbon,
                {
                  borderRadius: theme.radius.md + 2,
                  marginBottom: theme.spacing[1.5],
                  paddingHorizontal: theme.spacing[2.5],
                  paddingVertical: theme.spacing[2],
                  borderColor: bullish ? hslAlpha(theme.colors.tradeBuy, 0.4) : hslAlpha(theme.colors.tradeSell, 0.4),
                  backgroundColor: bullish
                    ? hslAlpha(theme.colors.tradeBuy, 0.12)
                    : hslAlpha(theme.colors.tradeSell, 0.12),
                },
              ]}
            >
              <View
                style={[
                  styles.capBar,
                  {
                    width: `${capShare}%`,
                    backgroundColor: bullish ? hslAlpha(theme.colors.tradeBuy, 0.2) : hslAlpha(theme.colors.tradeSell, 0.2),
                  },
                ]}
              />
              <View style={styles.ribbonContent}>
                <View>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      { color: '#FFF', fontFamily: theme.fonts.sansBold },
                    ]}
                  >
                    {idx + 1}. {row.baseAsset}
                  </Text>
                  <Text
                    style={[
                      theme.typography.labelSm,
                      { color: m.mutedText, marginTop: theme.spacing[0.5] },
                    ]}
                  >
                    Vol {formatVolume(row.volume24h)} · MCap {formatMarketCap(row.marketCap ?? 0)}
                  </Text>
                </View>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color, fontFamily: theme.fonts.sansBold },
                  ]}
                >
                  {formatChangePct(row.changePct)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  ribbon: { borderWidth: 1, overflow: 'hidden' },
  capBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  ribbonContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
