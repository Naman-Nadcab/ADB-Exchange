import { memo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import type { RecentTrade } from '@exchange/mobile-types';

type Props = { trades: RecentTrade[]; maxRows?: number };

function RecentTradesListInner({ trades, maxRows = 20 }: Props) {
  const { theme } = useTheme();
  const data = trades.slice(0, maxRows);

  return (
    <TerminalPanel style={styles.wrap}>
      <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, marginBottom: 8 }]}>
        Recent Trades
      </Text>
      <View style={styles.columns}>
        <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Price</Text>
        <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Qty</Text>
        <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Time</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        initialNumToRender={maxRows}
        renderItem={({ item }) => {
          const color = item.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
          const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <View style={styles.row} accessibilityLabel={`${item.side} ${item.price}`}>
              <Text style={{ color: `hsl(${color})`, fontSize: 12, flex: 1, fontFamily: theme.fonts.mono }}>{item.price}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1, fontFamily: theme.fonts.mono }}>
                {item.quantity}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, flex: 1, textAlign: 'right' }}>
                {time}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            Waiting for trades…
          </Text>
        }
      />
    </TerminalPanel>
  );
}

export const RecentTradesList = memo(RecentTradesListInner);

const styles = StyleSheet.create({
  wrap: { flex: 1, marginTop: 8 },
  columns: { flexDirection: 'row', marginBottom: 4 },
  colHead: { flex: 1, fontSize: 10, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 3, minHeight: 22 },
});
