import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  pairs: MarketListItem[];
  onSelect: (symbol: string) => void;
};

export function RelatedPairsSection({ pairs, onSelect }: Props) {
  const { theme } = useTheme();
  if (!pairs.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }]}>
        Related Markets
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pairs.map((item) => {
          const ck = changeColorKey(item.changePct);
          const color = ck === 'buy' ? theme.colors.tradeBuy : ck === 'sell' ? theme.colors.tradeSell : theme.colors.foregroundSecondary;
          return (
            <Pressable
              key={item.symbol}
              onPress={() => {
                void hapticLight();
                onSelect(item.symbol);
              }}
              style={[styles.chip, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}
            >
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 13 }}>
                {item.baseAsset}/{item.quoteAsset}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, marginTop: 4 }}>
                {formatPrice(item.lastPrice, '')}
              </Text>
              <Text style={{ color: `hsl(${color})`, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                {formatChangePct(item.changePct)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingRight: 8 },
  chip: { padding: 12, borderRadius: 12, borderWidth: 1, minWidth: 110 },
});
