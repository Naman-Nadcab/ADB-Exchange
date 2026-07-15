import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { marketing } from '@shared/theme/marketing';
import { hapticLight } from '@shared/theme';
import { formatChangePct, formatVolume, formatMarketCap, changeColorKey } from '@core/domain/markets/formatPrice';
import type { MarketListItem } from '@exchange/mobile-types';

type Props = {
  rows: MarketListItem[];
  onSelect: (symbol: string) => void;
};

export function MarketsHeatmapSection({ rows, onSelect }: Props) {
  if (!rows.length) return null;
  const maxCap = Math.max(...rows.map((r) => r.marketCap ?? 0), 1);

  return (
    <View style={[styles.wrap, { borderColor: marketing.goldBorder, backgroundColor: marketing.cardBg }]}>
      <Text style={styles.title}>Market Heatmap</Text>
      <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {rows.map((row, idx) => {
          const bullish = row.changePct >= 0;
          const color = changeColorKey(row.changePct) === 'buy' ? '#34D399' : '#FB7185';
          const capShare = Math.max(20, Math.min(100, ((row.marketCap ?? 0) / maxCap) * 100));
          return (
            <Pressable
              key={row.symbol}
              onPress={() => {
                void hapticLight();
                onSelect(row.symbol);
              }}
              style={[
                styles.ribbon,
                {
                  borderColor: bullish ? 'rgba(52,211,153,0.4)' : 'rgba(251,113,133,0.4)',
                  backgroundColor: bullish ? 'rgba(6,78,59,0.35)' : 'rgba(127,29,29,0.35)',
                },
              ]}
            >
              <View style={[styles.capBar, { width: `${capShare}%`, backgroundColor: bullish ? 'rgba(52,211,153,0.2)' : 'rgba(251,113,133,0.2)' }]} />
              <View style={styles.ribbonContent}>
                <View>
                  <Text style={styles.asset}>{idx + 1}. {row.baseAsset}</Text>
                  <Text style={styles.meta}>Vol {formatVolume(row.volume24h)} · MCap {formatMarketCap(row.marketCap ?? 0)}</Text>
                </View>
                <Text style={[styles.change, { color }]}>{formatChangePct(row.changePct)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14, maxHeight: 280 },
  title: { color: marketing.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  scroll: { maxHeight: 220 },
  ribbon: { borderRadius: 10, borderWidth: 1, marginBottom: 6, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 8 },
  capBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  ribbonContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  asset: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  meta: { color: marketing.mutedText, fontSize: 10, marginTop: 2 },
  change: { fontSize: 13, fontWeight: '700' },
});
