import { memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { hapticLight } from '@shared/theme';
import { marketing } from '@shared/theme/marketing';
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
  return (
    <View style={[styles.card, { borderColor: marketing.goldBorder, backgroundColor: marketing.cardBg }]}>
      <Text style={[styles.cardTitle, { color: marketing.gold }]}>{title}</Text>
      {items.map((item) => {
        const ck = changeColorKey(item.changePct);
        const color =
          ck === 'buy' ? '#34D399' : ck === 'sell' ? '#FB7185' : marketing.mutedText;
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
              <View style={[styles.coin, { backgroundColor: 'rgba(245,184,0,0.12)' }]}>
                <Text style={styles.coinText}>{item.baseAsset.slice(0, 2)}</Text>
              </View>
              <View>
                <Text style={styles.symbol}>{item.baseAsset}</Text>
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
              <Text style={styles.price}>{formatPrice(item.lastPrice, '')}</Text>
              <Text style={[styles.change, { color }]}>{formatChangePct(item.changePct)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MarketsHeaderWidgetsInner({ gainers, losers, trending, newListings, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={196}
      style={styles.scroll}
      contentContainerStyle={styles.content}
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
  scroll: { marginBottom: 14 },
  content: { paddingRight: 12, gap: 10 },
  card: {
    width: 186,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    minHeight: 36,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontSize: 10, fontWeight: '800', color: marketing.gold },
  symbol: { color: '#FFF', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  itemRight: { alignItems: 'flex-end' },
  price: { color: '#FFF', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  change: { fontSize: 11, fontWeight: '700', marginTop: 1 },
});
