import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  gainers: MarketListItem[];
  losers: MarketListItem[];
  trending: MarketListItem[];
  onSelect: (symbol: string) => void;
};

function WidgetCard({
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
    <View style={[styles.card, { backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Text style={[styles.cardTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{title}</Text>
      {items.map((item) => {
        const ck = changeColorKey(item.changePct);
        const color =
          ck === 'buy' ? theme.colors.tradeBuy : ck === 'sell' ? theme.colors.tradeSell : theme.colors.foregroundSecondary;
        return (
          <Pressable
            key={item.symbol}
            onPress={() => onSelect(item.symbol)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={`${item.baseAsset} ${formatChangePct(item.changePct)}`}
          >
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
              {item.baseAsset}
            </Text>
            <Text style={{ color: `hsl(${color})`, fontSize: 12 }}>{formatChangePct(item.changePct)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MarketsHeaderWidgets({ gainers, losers, trending, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <WidgetCard title="Top Gainers" items={gainers} onSelect={onSelect} />
      <WidgetCard title="Top Losers" items={losers} onSelect={onSelect} />
      <WidgetCard title="Trending" items={trending} onSelect={onSelect} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 12 },
  card: {
    width: 140,
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, minHeight: 28 },
});
