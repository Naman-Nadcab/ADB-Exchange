import { memo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { RecentTrade } from '@exchange/mobile-types';

type Props = { trades: RecentTrade[]; maxRows?: number };

function RecentTradesListInner({ trades, maxRows = 20 }: Props) {
  const { theme } = useTheme();
  const data = trades.slice(0, maxRows);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Trades</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        initialNumToRender={maxRows}
        renderItem={({ item }) => {
          const color = item.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
          const time = item.time ? new Date(item.time).toLocaleTimeString() : '';
          return (
            <View style={styles.row} accessibilityLabel={`${item.side} ${item.price}`}>
              <Text style={{ color: `hsl(${color})`, fontSize: 12 }}>{item.price}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                {item.quantity}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>{time}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

export const RecentTradesList = memo(RecentTradesListInner);

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, minHeight: 20 },
});
