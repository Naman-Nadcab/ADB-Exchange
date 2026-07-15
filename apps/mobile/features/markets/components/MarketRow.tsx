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
  variant?: 'card' | 'flat';
};

function MarketRowInner({ item, onPress, onLongPress, isFavorite, rank, variant = 'flat' }: Props) {
  const { theme } = useTheme();
  const changeKey = changeColorKey(item.changePct);
  const changeColor =
    changeKey === 'buy'
      ? theme.colors.tradeBuy
      : changeKey === 'sell'
        ? theme.colors.tradeSell
        : theme.colors.foregroundSecondary;

  const isFlat = variant === 'flat';

  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        isFlat
          ? {
              borderBottomColor: `hsl(${theme.colors.borderDefault})`,
              backgroundColor: pressed ? `hsl(${theme.colors.surfaceMuted} / 0.35)` : 'transparent',
            }
          : {
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              borderColor: `hsl(${theme.colors.borderDefault})`,
              opacity: pressed ? 0.92 : 1,
            },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.baseAsset} ${item.quoteAsset}, price ${formatPrice(item.lastPrice, item.quoteAsset)}, change ${formatChangePct(item.changePct)}`}
    >
      <View style={styles.pairCol}>
        {rank != null ? (
          <Text style={[styles.rank, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{rank}</Text>
        ) : null}
        <View style={[styles.icon, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)` }]}>
          <Text style={[styles.iconText, { color: `hsl(${theme.colors.brandPrimary})` }]}>
            {item.baseAsset.slice(0, 2)}
          </Text>
        </View>
        <View style={styles.pairMeta}>
          <View style={styles.symbolRow}>
            <Text style={[styles.symbol, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {item.baseAsset}
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>
                /{item.quoteAsset}
              </Text>
            </Text>
            {isFavorite ? (
              <Ionicons name="star" size={11} color={`hsl(${theme.colors.brandPrimary})`} />
            ) : null}
          </View>
          <Text style={[styles.vol, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Vol {item.volume24h.toLocaleString(undefined, { notation: 'compact' })}
          </Text>
        </View>
      </View>

      <Sparkline
        data={
          item.sparkline && item.sparkline.length >= 2
            ? item.sparkline
            : sparklineFromChange(item.changePct, item.symbol.length)
        }
        color={`hsl(${changeColor})`}
        width={48}
        height={22}
      />

      <View style={styles.priceCol}>
        <Text style={[styles.price, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {formatPrice(item.lastPrice, '')}
        </Text>
        <View style={[styles.changePill, { backgroundColor: `hsl(${changeColor} / 0.14)` }]}>
          <Text style={{ color: `hsl(${changeColor})`, fontSize: 11, fontWeight: '700' }}>
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
    paddingHorizontal: 4,
    paddingVertical: 11,
    minHeight: 56,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 0,
  },
  pairCol: { flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { width: 18, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 11, fontWeight: '800' },
  pairMeta: { flex: 1 },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbol: { fontSize: 14, fontWeight: '700' },
  vol: { fontSize: 10, marginTop: 1 },
  priceCol: { alignItems: 'flex-end', minWidth: 88 },
  price: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: 'IBMPlexMono_600SemiBold' },
  changePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
});
