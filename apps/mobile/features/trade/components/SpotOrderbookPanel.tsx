import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, TerminalTabs, SegmentControl, SkeletonList } from '@shared/ui';
import { formatPrice } from '@core/domain/markets/formatPrice';
import {
  groupBookLevels,
  cumulativeTotals,
  computeBookSentiment,
  computeBookIntelligence,
  defaultDisplayPricePrecision,
  tickOptionsForInstrument,
  DEPTH_OPTIONS,
  type BookLevel,
} from '@core/domain/trade/orderbookPanel';
import type { OrderbookSnapshot, RecentTrade } from '@exchange/mobile-types';

type PanelTab = 'orderbook' | 'ladder' | 'trades';
type BookView = 'both' | 'asks' | 'bids';

type Props = {
  book?: OrderbookSnapshot;
  recentTrades?: RecentTrade[];
  quoteAsset: string;
  baseAsset: string;
  lastPrice?: string | null;
  pricePrecision?: number;
  loading?: boolean;
  onPriceClick?: (price: string, quantity: string) => void;
  onTradePriceClick?: (price: string, quantity: string) => void;
};

function formatTradeTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

function LevelRow({
  level,
  side,
  total,
  depthPct,
  variant,
  onSelect,
}: {
  level: BookLevel;
  side: 'buy' | 'sell';
  total: string;
  depthPct: number;
  variant: 'book' | 'ladder';
  onSelect?: (p: string, q: string) => void;
}) {
  const { theme } = useTheme();
  const color = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
  const w = Math.min(100, Math.max(0, depthPct));
  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        onSelect?.(level.rawPrice, level.quantity);
      }}
      style={[styles.levelRow, variant === 'ladder' && styles.ladderRow]}
    >
      <View
        style={[
          styles.depthFill,
          {
            width: `${w}%`,
            backgroundColor: `hsl(${color} / ${variant === 'ladder' ? 0.22 : 0.28})`,
          },
        ]}
      />
      <Text style={[styles.cell, { color: `hsl(${color})`, fontFamily: theme.fonts.mono }]}>{level.price}</Text>
      <Text style={[styles.cell, styles.qtyCol, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono }]}>
        {level.quantity}
      </Text>
      <Text style={[styles.cell, styles.totalCol, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono }]}>
        {total}
      </Text>
    </Pressable>
  );
}

function SentimentFooter({ buyPct, sellPct }: { buyPct: number; sellPct: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sentiment}>
      <Text style={[styles.sentLabel, { color: `hsl(${theme.colors.tradeBuy})` }]}>B {buyPct.toFixed(0)}%</Text>
      <View style={[styles.sentBar, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View style={[styles.sentBuy, { width: `${buyPct}%`, backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.65)` }]} />
        <View style={[styles.sentSell, { width: `${sellPct}%`, backgroundColor: `hsl(${theme.colors.tradeSell} / 0.65)` }]} />
      </View>
      <Text style={[styles.sentLabel, { color: `hsl(${theme.colors.tradeSell})` }]}>S {sellPct.toFixed(0)}%</Text>
    </View>
  );
}

export function SpotOrderbookPanel({
  book,
  recentTrades = [],
  quoteAsset,
  baseAsset,
  lastPrice,
  pricePrecision = 8,
  loading,
  onPriceClick,
  onTradePriceClick,
}: Props) {
  const { theme } = useTheme();
  const [panelTab, setPanelTab] = useState<PanelTab>('orderbook');
  const [bookView, setBookView] = useState<BookView>('both');
  const [flipVertical, setFlipVertical] = useState(false);
  const [depthLimit, setDepthLimit] = useState<(typeof DEPTH_OPTIONS)[number]>(20);
  const [displayPrecision, setDisplayPrecision] = useState(() => defaultDisplayPricePrecision(pricePrecision));
  const [lastMove, setLastMove] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef<string | null>(null);

  useEffect(() => {
    if (!lastPrice) return;
    if (prevPrice.current && prevPrice.current !== lastPrice) {
      setLastMove(parseFloat(lastPrice) >= parseFloat(prevPrice.current) ? 'up' : 'down');
    }
    prevPrice.current = lastPrice;
  }, [lastPrice]);

  const tickOptions = useMemo(() => tickOptionsForInstrument(pricePrecision), [pricePrecision]);

  const bids = useMemo(
    () => groupBookLevels(book?.bids.slice(0, depthLimit) ?? [], displayPrecision, 'buy'),
    [book?.bids, depthLimit, displayPrecision],
  );
  const asks = useMemo(
    () => groupBookLevels(book?.asks.slice(0, depthLimit) ?? [], displayPrecision, 'sell'),
    [book?.asks, depthLimit, displayPrecision],
  );

  const bidDepth = useMemo(() => cumulativeTotals(bids), [bids]);
  const askDepth = useMemo(() => cumulativeTotals(asks), [asks]);

  const sentiment = useMemo(() => computeBookSentiment(bids, asks), [bids, asks]);
  const intel = useMemo(() => computeBookIntelligence(bids, asks, lastPrice), [bids, asks, lastPrice]);

  const displayLast = lastPrice ?? '—';
  const midSpread =
    bids[0] && asks[0]
      ? `${intel.spreadAbs} (${intel.spreadPct}%)`
      : '—';

  const renderMid = useCallback(
    () => (
      <Pressable
        onPress={() => {
          if (lastPrice) onPriceClick?.(lastPrice, '');
        }}
        style={[styles.midRow, { backgroundColor: `hsl(${theme.colors.backgroundPanel} / 0.5)` }]}
      >
        <View style={styles.midLeft}>
          {lastMove === 'up' ? (
            <Ionicons name="chevron-up" size={12} color={`hsl(${theme.colors.tradeBuy})`} />
          ) : lastMove === 'down' ? (
            <Ionicons name="chevron-down" size={12} color={`hsl(${theme.colors.tradeSell})`} />
          ) : null}
          <Text style={[styles.midPrice, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono }]}>
            {formatPrice(parseFloat(displayLast) || 0, '')}
          </Text>
        </View>
        <Text style={[styles.midSpread, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{midSpread}</Text>
      </Pressable>
    ),
    [lastMove, displayLast, midSpread, lastPrice, onPriceClick, theme],
  );

  const renderSide = (side: 'buy' | 'sell', levels: BookLevel[], totals: number[], maxCum: number, variant: 'book' | 'ladder') =>
    levels.map((lv, i) => {
      const depthPct = (totals[i]! / maxCum) * 100;
      const total = formatPrice(totals[i]!, quoteAsset);
      return (
        <LevelRow
          key={`${side}-${lv.price}-${i}`}
          level={lv}
          side={side}
          total={total}
          depthPct={depthPct}
          variant={variant}
          onSelect={onPriceClick}
        />
      );
    });

  const bookContent = (variant: 'book' | 'ladder') => {
    const askRows = renderSide('sell', [...asks].reverse(), [...askDepth.totals].reverse(), askDepth.maxCum, variant);
    const bidRows = renderSide('buy', bids, bidDepth.totals, bidDepth.maxCum, variant);
    const showAsks = bookView === 'both' || bookView === 'asks';
    const showBids = bookView === 'both' || bookView === 'bids';

    if (flipVertical) {
      return (
        <>
          {showBids ? bidRows : null}
          {renderMid()}
          {showAsks ? askRows : null}
        </>
      );
    }
    return (
      <>
        {showAsks ? askRows : null}
        {renderMid()}
        {showBids ? bidRows : null}
      </>
    );
  };

  const tradesContent = (
    <ScrollView style={{ maxHeight: 360 }}>
      <View style={styles.columns}>
        <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Price</Text>
        <Text style={[styles.colHead, styles.qtyCol, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Qty</Text>
        <Text style={[styles.colHead, styles.totalCol, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Time</Text>
      </View>
      {recentTrades.slice(0, 48).map((t, i) => {
        const sideColor = t.side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
        return (
          <Pressable
            key={`${t.id ?? t.time}-${i}`}
            onPress={() => onTradePriceClick?.(t.price, t.quantity)}
            style={styles.levelRow}
          >
            <Text style={[styles.cell, { color: `hsl(${sideColor})`, fontFamily: theme.fonts.mono }]}>{t.price}</Text>
            <Text style={[styles.cell, styles.qtyCol, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono }]}>
              {t.quantity}
            </Text>
            <Text style={[styles.cell, styles.totalCol, { color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }]}>
              {formatTradeTime(t.time ?? t.created_at ?? '')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <TerminalPanel style={{ flex: 1 }}>
      <TerminalTabs
        tabs={[
          { id: 'orderbook', label: 'Book' },
          { id: 'ladder', label: 'DOM' },
          { id: 'trades', label: 'Trades' },
        ]}
        active={panelTab}
        onChange={(id) => setPanelTab(id as PanelTab)}
      />

      {panelTab !== 'trades' ? (
        <>
          <View style={styles.toolbar}>
            <TerminalTabs
              tabs={[
                { id: 'both', label: 'Both' },
                { id: 'asks', label: 'Asks' },
                { id: 'bids', label: 'Bids' },
              ]}
              active={bookView}
              onChange={(id) => setBookView(id as BookView)}
            />
            <Pressable onPress={() => setFlipVertical((v) => !v)} accessibilityLabel="Flip book">
              <Ionicons name="swap-vertical" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
            </Pressable>
          </View>
          <View style={styles.controls}>
            <SegmentControl
              tabs={tickOptions.map((p) => ({ id: String(p), label: `0.${'0'.repeat(p - 1)}1` }))}
              active={String(displayPrecision)}
              onChange={(id) => setDisplayPrecision(Number(id))}
            />
            <SegmentControl
              tabs={DEPTH_OPTIONS.map((d) => ({ id: String(d), label: String(d) }))}
              active={String(depthLimit)}
              onChange={(id) => setDepthLimit(Number(id) as (typeof DEPTH_OPTIONS)[number])}
            />
          </View>
        </>
      ) : null}

      {loading && !book ? <SkeletonList rows={6} /> : null}

      {panelTab === 'trades' ? (
        tradesContent
      ) : (
        <ScrollView style={{ maxHeight: panelTab === 'ladder' ? 420 : 320 }} nestedScrollEnabled>
          <View style={styles.columns}>
            <Text style={[styles.colHead, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Price ({quoteAsset})</Text>
            <Text style={[styles.colHead, styles.qtyCol, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Qty ({baseAsset})</Text>
            <Text style={[styles.colHead, styles.totalCol, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Total</Text>
          </View>
          {bookContent(panelTab === 'ladder' ? 'ladder' : 'book')}
        </ScrollView>
      )}

      {panelTab !== 'trades' ? (
        <>
          <SentimentFooter buyPct={sentiment.buyPct} sellPct={sentiment.sellPct} />
          <View style={[styles.intelRow, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Text style={[styles.intelText, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Spr {intel.spreadBps} bps · {intel.dominance} · Imb {intel.imbalancePct.toFixed(1)}%
            </Text>
            <Text style={[styles.intelText, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Wall B {intel.largestBid} / A {intel.largestAsk}
            </Text>
          </View>
        </>
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  controls: { gap: 6, marginBottom: 6 },
  columns: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 2 },
  colHead: { flex: 1, fontSize: 10, fontWeight: '600' },
  qtyCol: { flex: 0.9, textAlign: 'right' },
  totalCol: { flex: 1, textAlign: 'right' },
  levelRow: { flexDirection: 'row', paddingVertical: 3, minHeight: 24, position: 'relative', overflow: 'hidden', paddingHorizontal: 2 },
  ladderRow: { minHeight: 36, paddingVertical: 6 },
  depthFill: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  cell: { flex: 1, fontSize: 11, fontVariant: ['tabular-nums'], zIndex: 1 },
  midRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 6, marginVertical: 4, borderRadius: 6 },
  midLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  midPrice: { fontSize: 14, fontWeight: '700' },
  midSpread: { fontSize: 10 },
  sentiment: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8 },
  sentBar: { flex: 1, height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  sentBuy: { height: '100%' },
  sentSell: { height: '100%' },
  sentLabel: { fontSize: 10, fontWeight: '700', width: 36 },
  intelRow: { marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  intelText: { fontSize: 9, lineHeight: 12 },
});
