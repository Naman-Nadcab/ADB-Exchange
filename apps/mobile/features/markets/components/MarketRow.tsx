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
        {
          paddingHorizontal: theme.spacing[1],
          paddingVertical: theme.spacing[2.5],
          minHeight: theme.listDensity.default.rowHeight,
          gap: theme.spacing[2],
          opacity: !isFlat && pressed ? theme.opacity.pressed : 1,
        },
        isFlat
          ? {
              borderBottomColor: `hsl(${theme.colors.borderDefault})`,
              backgroundColor: pressed ? `hsl(${theme.colors.surfaceMuted} / 0.35)` : 'transparent',
            }
          : {
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              borderColor: `hsl(${theme.colors.borderDefault})`,
              opacity: pressed ? theme.opacity.pressed : 1,
            },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.baseAsset} ${item.quoteAsset}, price ${formatPrice(item.lastPrice, item.quoteAsset)}, change ${formatChangePct(item.changePct)}`}
    >
      <View style={styles.pairCol}>
        {rank != null ? (
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, width: 18, textAlign: 'center', fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {rank}
          </Text>
        ) : null}
        <View
          style={[
            styles.icon,
            {
              width: theme.sizes.avatarSm,
              height: theme.sizes.avatarSm,
              borderRadius: theme.sizes.avatarSm / 2,
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)`,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelMd,
              { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold, fontWeight: '800' },
            ]}
          >
            {item.baseAsset.slice(0, 2)}
          </Text>
        </View>
        <View style={styles.pairMeta}>
          <View style={[styles.symbolRow, { gap: theme.spacing[1] }]}>
            <Text
              style={[
                theme.typography.bodyMd,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
              ]}
            >
              {item.baseAsset}
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>
                /{item.quoteAsset}
              </Text>
            </Text>
            {isFavorite ? (
              <Ionicons name="star" size={theme.sizes.iconSm - 9} color={`hsl(${theme.colors.brandPrimary})`} />
            ) : null}
          </View>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] }]}>
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
        <Text
          style={[
            theme.typography.price,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.monoSemiBold },
          ]}
        >
          {formatPrice(item.lastPrice, '')}
        </Text>
        <View
          style={[
            styles.changePill,
            {
              paddingHorizontal: theme.spacing[1.5],
              paddingVertical: theme.spacing[0.5],
              borderRadius: theme.radius.sm,
              marginTop: theme.spacing[0.5],
              backgroundColor: `hsl(${changeColor} / 0.14)`,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelMd,
              { color: `hsl(${changeColor})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 0,
  },
  pairCol: { flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  pairMeta: { flex: 1 },
  symbolRow: { flexDirection: 'row', alignItems: 'center' },
  priceCol: { alignItems: 'flex-end', minWidth: 88 },
  changePill: {},
});
