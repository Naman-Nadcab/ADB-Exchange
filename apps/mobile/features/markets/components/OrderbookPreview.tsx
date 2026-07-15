import { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import { computeSpread } from '@core/domain/trade/orderbook';
import type { OrderbookSnapshot } from '@exchange/mobile-types';

type Props = {
  book?: OrderbookSnapshot;
  maxRows?: number;
};

function OrderbookPreviewInner({ book, maxRows = 6 }: Props) {
  const { theme } = useTheme();
  const bids = useMemo(() => book?.bids.slice(0, maxRows) ?? [], [book?.bids, maxRows]);
  const asks = useMemo(() => book?.asks.slice(0, maxRows) ?? [], [book?.asks, maxRows]);
  const spread = computeSpread(bids[0]?.price, asks[0]?.price);

  return (
    <TerminalPanel style={{ marginBottom: 12 }}>
      {spread ? (
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 6 }]}>
          Spread {spread}
        </Text>
      ) : null}
      <View style={styles.columns}>
        <Text style={[styles.head, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Bid</Text>
        <Text style={[styles.head, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Ask</Text>
      </View>
      {Array.from({ length: maxRows }).map((_, i) => {
        const bid = bids[i];
        const ask = asks[asks.length - 1 - i];
        return (
          <View key={i} style={styles.row}>
            <Text style={{ flex: 1, color: `hsl(${theme.colors.tradeBuy})`, fontFamily: theme.fonts.mono, fontSize: 11 }}>
              {bid?.price ?? '—'}
            </Text>
            <Text style={{ flex: 1, textAlign: 'right', color: `hsl(${theme.colors.tradeSell})`, fontFamily: theme.fonts.mono, fontSize: 11 }}>
              {ask?.price ?? '—'}
            </Text>
          </View>
        );
      })}
    </TerminalPanel>
  );
}

export const OrderbookPreview = memo(OrderbookPreviewInner);

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', marginBottom: 4 },
  head: { flex: 1, fontSize: 10, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 3 },
});
