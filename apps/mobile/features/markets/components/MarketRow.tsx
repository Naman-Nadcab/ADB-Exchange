import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { Sparkline, sparklineFromChange } from './Sparkline';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  item: MarketListItem;
  onPress: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  rank?: number;
};

function MarketRowInner({ item, onPress, onLongPress, isFavorite, rank }: Props) {
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
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.baseAsset} ${item.quoteAsset}, price ${formatPrice(item.lastPrice, item.quoteAsset)}, change ${formatChangePct(item.changePct)}`}
    >
      {rank != null ? (
        <Text style={[styles.rank, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{rank}</Text>
      ) : null}
      <View style={styles.left}>
        <View style={[styles.icon, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
          <Text style={{ fontWeight: '700', fontSize: 12, color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {item.baseAsset.slice(0, 2)}
          </Text>
        </View>
        <View>
          <View style={styles.symbolRow}>
            <Text style={[styles.symbol, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {item.baseAsset}
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>
                /{item.quoteAsset}
              </Text>
            </Text>
            {isFavorite ? (
              <Ionicons name="star" size={12} color={`hsl(${theme.colors.brandPrimary})`} />
            ) : null}
          </View>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            Vol {item.volume24h.toLocaleString(undefined, { notation: 'compact' })}
          </Text>
        </View>
      </View>
      <Sparkline
        data={sparklineFromChange(item.changePct, item.symbol.length)}
        color={`hsl(${changeColor})`}
        width={52}
        height={24}
      />
      <View style={styles.right}>
        <Text style={[styles.price, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {formatPrice(item.lastPrice, '')}
        </Text>
        <View style={[styles.changePill, { backgroundColor: `hsl(${changeColor} / 0.12)` }]}>
          <Text style={{ color: `hsl(${changeColor})`, fontSize: 12, fontWeight: '600' }}>
            {formatChangePct(item.changePct)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const MarketRow = memo(MarketRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 60,
    borderWidth: 1,
    gap: 8,
  },
  rank: { width: 20, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbol: { fontSize: 15, fontWeight: '700' },
  right: { alignItems: 'flex-end', minWidth: 80 },
  price: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  changePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
});
