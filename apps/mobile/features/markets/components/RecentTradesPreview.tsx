import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import type { RecentTrade } from '@exchange/mobile-types';

type Props = { trades: RecentTrade[]; maxRows?: number };

function RecentTradesPreviewInner({ trades, maxRows = 8 }: Props) {
  const { theme } = useTheme();
  const data = trades.slice(0, maxRows);

  return (
    <TerminalPanel style={{ marginBottom: 16 }}>
      <View style={styles.columns}>
        <Text style={[styles.head, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Price</Text>
        <Text style={[styles.head, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Qty</Text>
        <Text style={[styles.head, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Time</Text>
      </View>
      {data.length === 0 ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>
          Waiting for trades…
        </Text>
      ) : (
        data.map((item) => {
          const color = item.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
          const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <View key={item.id} style={styles.row}>
              <Text style={{ flex: 1, color: `hsl(${color})`, fontSize: 11, fontFamily: theme.fonts.mono }}>{item.price}</Text>
              <Text style={{ flex: 1, color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontFamily: theme.fonts.mono }}>{item.quantity}</Text>
              <Text style={{ flex: 1, color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, textAlign: 'right' }}>{time}</Text>
            </View>
          );
        })
      )}
    </TerminalPanel>
  );
}

export const RecentTradesPreview = memo(RecentTradesPreviewInner);

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', marginBottom: 4 },
  head: { flex: 1, fontSize: 10, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 3 },
});
