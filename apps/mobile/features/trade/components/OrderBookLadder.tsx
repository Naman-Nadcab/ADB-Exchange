import { memo, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, TerminalTabs } from '@shared/ui';
import { computeSpread } from '@core/domain/trade/orderbook';
import type { OrderbookSnapshot } from '@exchange/mobile-types';

type Props = {
  book?: OrderbookSnapshot;
  onSelectPrice?: (price: string, side: 'buy' | 'sell') => void;
  maxRows?: number;
};

function parseQty(q: string) {
  const n = parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

function OrderBookLadderInner({ book, onSelectPrice, maxRows = 12 }: Props) {
  const { theme } = useTheme();
  const [view, setView] = useState<'both' | 'asks' | 'bids'>('both');
  const bids = useMemo(() => book?.bids.slice(0, maxRows) ?? [], [book?.bids, maxRows]);
  const asks = useMemo(() => book?.asks.slice(0, maxRows) ?? [], [book?.asks, maxRows]);
  const spread = computeSpread(bids[0]?.price, asks[0]?.price);

  const maxBidQty = useMemo(() => Math.max(...bids.map((b) => parseQty(b.quantity)), 1), [bids]);
  const maxAskQty = useMemo(() => Math.max(...asks.map((a) => parseQty(a.quantity)), 1), [asks]);

  const renderRow = (side: 'buy' | 'sell', maxQty: number) =>
    function Row({ item }: { item: { price: string; quantity: string } }) {
      const color = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
      const depth = Math.min(1, parseQty(item.quantity) / maxQty);
      return (
        <Pressable
          onPress={() => {
            void hapticLight();
            onSelectPrice?.(item.price, side);
          }}
          style={styles.row}
          accessibilityLabel={`${side} ${item.price}`}
        >
          <View
            style={[
              styles.depthBar,
              {
                backgroundColor: `hsl(${color} / 0.12)`,
                width: `${depth * 100}%`,
                ...(side === 'sell' ? { right: 0, left: undefined } : { left: 0 }),
              },
            ]}
          />
          <Text style={[styles.cell, { color: `hsl(${color})`, fontFamily: theme.fonts.mono }]}>
            {item.price}
          </Text>
          <Text style={[styles.cell, styles.qty, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono }]}>
            {item.quantity}
          </Text>
        </Pressable>
      );
    };

  return (
    <TerminalPanel style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
          Order Book
        </Text>
        {spread ? (
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Spread {spread}
          </Text>
        ) : null}
      </View>
      <TerminalTabs
        tabs={[
          { id: 'both', label: 'Both' },
          { id: 'asks', label: 'Asks' },
          { id: 'bids', label: 'Bids' },
        ]}
        active={view}
        onChange={(id) => setView(id as typeof view)}
      />
      <View style={styles.columns}>
        <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Price</Text>
        <Text style={[styles.colHead, styles.qty, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Qty</Text>
      </View>
      {(view === 'both' || view === 'asks') && (
        <>
          <Text style={[styles.sideLabel, { color: `hsl(${theme.colors.tradeSell})` }]}>Asks</Text>
          <FlatList
            data={[...asks].reverse()}
            keyExtractor={(item, i) => `a-${item.price}-${i}`}
            renderItem={renderRow('sell', maxAskQty)}
            scrollEnabled={false}
            initialNumToRender={maxRows}
          />
        </>
      )}
      {(view === 'both' || view === 'bids') && (
        <>
          <Text style={[styles.sideLabel, { color: `hsl(${theme.colors.tradeBuy})`, marginTop: view === 'both' ? 8 : 0 }]}>
            Bids
          </Text>
          <FlatList
            data={bids}
            keyExtractor={(item, i) => `b-${item.price}-${i}`}
            renderItem={renderRow('buy', maxBidQty)}
            scrollEnabled={false}
            initialNumToRender={maxRows}
          />
        </>
      )}
    </TerminalPanel>
  );
}

export const OrderBookLadder = memo(OrderBookLadderInner);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  columns: { flexDirection: 'row', marginBottom: 4 },
  colHead: { flex: 1, fontSize: 10, fontWeight: '600' },
  sideLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  row: { flexDirection: 'row', paddingVertical: 3, minHeight: 24, position: 'relative', overflow: 'hidden' },
  depthBar: { position: 'absolute', top: 0, bottom: 0 },
  cell: { flex: 1, fontSize: 12, fontVariant: ['tabular-nums'] },
  qty: { textAlign: 'right' },
});
