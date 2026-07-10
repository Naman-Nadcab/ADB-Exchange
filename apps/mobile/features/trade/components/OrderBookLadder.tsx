import { memo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { computeSpread } from '@core/domain/trade/orderbook';
import type { OrderbookSnapshot } from '@exchange/mobile-types';

type Props = {
  book?: OrderbookSnapshot;
  onSelectPrice?: (price: string, side: 'buy' | 'sell') => void;
  maxRows?: number;
};

function OrderBookLadderInner({ book, onSelectPrice, maxRows = 12 }: Props) {
  const { theme } = useTheme();
  const bids = book?.bids.slice(0, maxRows) ?? [];
  const asks = book?.asks.slice(0, maxRows) ?? [];
  const spread = computeSpread(bids[0]?.price, asks[0]?.price);

  const renderRow = (side: 'buy' | 'sell') =>
    function Row({ item }: { item: { price: string; quantity: string } }) {
      const color = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
      return (
        <Pressable
          onPress={() => onSelectPrice?.(item.price, side)}
          style={styles.row}
          accessibilityLabel={`${side} ${item.price}`}
        >
          <Text style={{ color: `hsl(${color})`, fontVariant: ['tabular-nums'], fontSize: 12 }}>
            {item.price}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {item.quantity}
          </Text>
        </Pressable>
      );
    };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Order Book</Text>
      {spread ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginBottom: 4 }}>
          Spread {spread}
        </Text>
      ) : null}
      <Text style={[styles.side, { color: `hsl(${theme.colors.tradeSell})` }]}>Asks</Text>
      <FlatList
        data={[...asks].reverse()}
        keyExtractor={(item, i) => `a-${item.price}-${i}`}
        renderItem={renderRow('sell')}
        scrollEnabled={false}
        initialNumToRender={maxRows}
      />
      <Text style={[styles.side, { color: `hsl(${theme.colors.tradeBuy})`, marginTop: 8 }]}>Bids</Text>
      <FlatList
        data={bids}
        keyExtractor={(item, i) => `b-${item.price}-${i}`}
        renderItem={renderRow('buy')}
        scrollEnabled={false}
        initialNumToRender={maxRows}
      />
    </View>
  );
}

export const OrderBookLadder = memo(OrderBookLadderInner);

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 200 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  side: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, minHeight: 22 },
});
