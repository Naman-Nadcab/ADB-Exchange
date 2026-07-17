import { memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { hapticLight, useTheme, hsl } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { Sparkline, sparklineFromChange } from './Sparkline';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  gainers: MarketListItem[];
  losers: MarketListItem[];
  trending: MarketListItem[];
  newListings: MarketListItem[];
  onSelect: (symbol: string) => void;
};

function MoverCard({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: MarketListItem[];
  onSelect: (s: string) => void;
}) {
  const { theme } = useTheme();
  const m = theme.marketing;
  const buy = hsl(theme.colors.tradeBuy);
  const sell = hsl(theme.colors.tradeSell);

  return (
    <ExchangeCard variant="marketing" style={[styles.card, { width: 186 }]}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: m.gold,
            fontFamily: theme.fonts.sansBold,
            marginBottom: theme.spacing[2.5],
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          },
        ]}
      >
        {title}
      </Text>
      {items.map((item) => {
        const ck = changeColorKey(item.changePct);
        const color = ck === 'buy' ? buy : ck === 'sell' ? sell : m.mutedText;
        return (
          <Pressable
            key={item.symbol}
            onPress={() => {
              void hapticLight();
              onSelect(item.symbol);
            }}
            style={[styles.item, { paddingVertical: theme.spacing[1.5], minHeight: theme.listDensity.default.rowHeight - 20 }]}
            accessibilityRole="button"
          >
            <View style={[styles.itemLeft, { gap: theme.spacing[2] }]}>
              <View
                style={[
                  styles.coin,
                  {
                    width: theme.spacing[7],
                    height: theme.spacing[7],
                    borderRadius: theme.spacing[3.5],
                    backgroundColor: m.insetHighlight,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.labelSm,
                    { color: m.gold, fontFamily: theme.fonts.sansBold, fontWeight: '800' },
                  ]}
                >
                  {item.baseAsset.slice(0, 2)}
                </Text>
              </View>
              <View>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: '#FFF', fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[0.5] },
                  ]}
                >
                  {item.baseAsset}
                </Text>
                <Sparkline
                  data={
                    item.sparkline && item.sparkline.length >= 2
                      ? item.sparkline
                      : sparklineFromChange(item.changePct, item.symbol.length)
                  }
                  color={color}
                  width={56}
                  height={22}
                />
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: '#FFF', fontFamily: theme.fonts.monoSemiBold, fontVariant: ['tabular-nums'] },
                ]}
              >
                {formatPrice(item.lastPrice, '')}
              </Text>
              <Text
                style={[
                  theme.typography.labelMd,
                  { color, fontFamily: theme.fonts.sansBold, marginTop: theme.spacing[0.5] },
                ]}
              >
                {formatChangePct(item.changePct)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ExchangeCard>
  );
}

function MarketsHeaderWidgetsInner({ gainers, losers, trending, newListings, onSelect }: Props) {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={196}
      style={{ marginBottom: theme.spacing[3.5] }}
      contentContainerStyle={{ paddingRight: theme.spacing[3], gap: theme.spacing[2.5] }}
    >
      <MoverCard title="Trending" items={trending} onSelect={onSelect} />
      <MoverCard title="Top Gainers" items={gainers} onSelect={onSelect} />
      <MoverCard title="Top Losers" items={losers} onSelect={onSelect} />
      <MoverCard title="New Listings" items={newListings} onSelect={onSelect} />
    </ScrollView>
  );
}

export const MarketsHeaderWidgets = memo(MarketsHeaderWidgetsInner);

const styles = StyleSheet.create({
  card: {},
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  coin: { alignItems: 'center', justifyContent: 'center' },
  itemRight: { alignItems: 'flex-end' },
});
