import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { Sparkline, sparklineFromChange } from './Sparkline';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  item: MarketListItem;
  onPress: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

function MarketRowInner({ item, onPress, onLongPress }: Props) {
  const { theme } = useTheme();
  const changeKey = changeColorKey(item.changePct);
  const changeColor =
    changeKey === 'buy'
      ? theme.colors.tradeBuy
      : changeKey === 'sell'
        ? theme.colors.tradeSell
        : theme.colors.foregroundSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.baseAsset} ${item.quoteAsset}, price ${formatPrice(item.lastPrice, item.quoteAsset)}, change ${formatChangePct(item.changePct)}`}
    >
      <View style={styles.left}>
        <View style={[styles.icon, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {item.baseAsset.slice(0, 2)}
          </Text>
        </View>
        <View>
          <Text style={[styles.symbol, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {item.baseAsset}/{item.quoteAsset}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            Vol {item.volume24h.toLocaleString()}
          </Text>
        </View>
      </View>
      <Sparkline
        data={sparklineFromChange(item.changePct, item.symbol.length)}
        color={`hsl(${changeColor})`}
      />
      <View style={styles.right}>
        <Text style={[styles.price, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {formatPrice(item.lastPrice, '')}
        </Text>
        <Text style={{ color: `hsl(${changeColor})`, fontSize: 13, fontWeight: '600' }}>
          {formatChangePct(item.changePct)}
        </Text>
      </View>
    </Pressable>
  );
}

export const MarketRow = memo(MarketRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 56,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontSize: 15, fontWeight: '600' },
  right: { alignItems: 'flex-end', minWidth: 88 },
  price: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
