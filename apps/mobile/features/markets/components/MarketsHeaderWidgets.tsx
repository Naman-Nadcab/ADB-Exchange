import { memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
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
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          borderColor: `hsl(${theme.colors.brandPrimary} / 0.15)`,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: `hsl(${theme.colors.brandPrimary})` }]}>{title}</Text>
      {items.map((item) => {
        const ck = changeColorKey(item.changePct);
        const color =
          ck === 'buy' ? theme.colors.tradeBuy : ck === 'sell' ? theme.colors.tradeSell : theme.colors.foregroundSecondary;
        return (
          <Pressable
            key={item.symbol}
            onPress={() => {
              void hapticLight();
              onSelect(item.symbol);
            }}
            style={styles.item}
            accessibilityRole="button"
          >
            <View style={styles.itemLeft}>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 13 }}>
                {item.baseAsset}
              </Text>
              <Sparkline
                data={sparklineFromChange(item.changePct, item.symbol.length)}
                color={`hsl(${color})`}
                width={48}
                height={20}
              />
            </View>
            <View style={styles.itemRight}>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                {formatPrice(item.lastPrice, '')}
              </Text>
              <Text style={{ color: `hsl(${color})`, fontSize: 11, fontWeight: '600' }}>
                {formatChangePct(item.changePct)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MarketsHeaderWidgetsInner({ gainers, losers, trending, newListings, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <MoverCard title="Trending" items={trending} onSelect={onSelect} />
      <MoverCard title="Top Gainers" items={gainers} onSelect={onSelect} />
      <MoverCard title="Top Losers" items={losers} onSelect={onSelect} />
      <MoverCard title="New Listings" items={newListings} onSelect={onSelect} />
    </ScrollView>
  );
}

export const MarketsHeaderWidgets = memo(MarketsHeaderWidgetsInner);

const styles = StyleSheet.create({
  scroll: { marginBottom: 12 },
  content: { paddingRight: 8 },
  card: {
    width: 168,
    padding: 12,
    borderWidth: 1,
    marginRight: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.3 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, minHeight: 32 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemRight: { alignItems: 'flex-end' },
});
