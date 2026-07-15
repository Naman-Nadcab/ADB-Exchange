import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { marketing } from '@shared/theme/marketing';
import { hapticLight } from '@shared/theme';
import { PillTabBar } from '@shared/ui';
import type { Announcement, MarketListItem } from '@exchange/mobile-types';
import { formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';

type Props = {
  news: Announcement[];
  announcements: Announcement[];
  newListings: MarketListItem[];
  bullishPct: number;
  bearishPct: number;
  onSelectPair: (symbol: string) => void;
};

export function MarketsIntelligencePanel({
  news,
  announcements,
  newListings,
  bullishPct,
  bearishPct,
  onSelectPair,
}: Props) {
  const [tab, setTab] = useState<'news' | 'announcements' | 'listings' | 'pulse'>('news');
  const items =
    tab === 'news' ? news : tab === 'announcements' ? announcements : tab === 'listings' ? [] : [];

  return (
    <View style={[styles.wrap, { borderColor: marketing.goldBorder, backgroundColor: marketing.cardBg }]}>
      <View style={styles.header}>
        <Ionicons name="newspaper-outline" size={16} color={marketing.gold} />
        <Text style={styles.title}>Market Intelligence</Text>
      </View>
      <PillTabBar
        tabs={[
          { id: 'news', label: 'News' },
          { id: 'announcements', label: 'Announcements' },
          { id: 'listings', label: 'New Listings' },
          { id: 'pulse', label: 'Pulse' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === 'pulse' ? (
        <View style={styles.pulse}>
          <PulseBar label="Bullish" pct={bullishPct} color="#34D399" />
          <PulseBar label="Bearish" pct={bearishPct} color="#FB7185" />
          <Text style={styles.pulseHint}>Based on 24H price direction across all pairs</Text>
        </View>
      ) : tab === 'listings' ? (
        <View style={styles.list}>
          {newListings.length === 0 ? (
            <Text style={styles.empty}>No new listings</Text>
          ) : (
            newListings.slice(0, 6).map((item) => (
              <Pressable
                key={item.symbol}
                style={styles.listingRow}
                onPress={() => {
                  void hapticLight();
                  onSelectPair(item.symbol);
                }}
              >
                <Text style={styles.listingSymbol}>{item.baseAsset}/{item.quoteAsset}</Text>
                <Text style={[styles.listingChange, { color: changeColorKey(item.changePct) === 'buy' ? '#34D399' : '#FB7185' }]}>
                  {formatChangePct(item.changePct)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {items.length === 0 ? (
            <Text style={styles.empty}>No {tab} available</Text>
          ) : (
            items.slice(0, 6).map((item, idx) => (
              <View key={item.id ?? `${item.title}-${idx}`} style={styles.newsRow}>
                <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                {item.summary ? (
                  <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function PulseBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={styles.pulseRow}>
      <Text style={styles.pulseLabel}>{label}</Text>
      <View style={styles.pulseTrack}>
        <View style={[styles.pulseFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.pulsePct, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  list: { marginTop: 10, gap: 8 },
  newsRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  newsTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  newsSummary: { color: marketing.mutedText, fontSize: 11, marginTop: 4 },
  listingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  listingSymbol: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  listingChange: { fontSize: 12, fontWeight: '700' },
  empty: { color: marketing.mutedText, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  pulse: { marginTop: 12, gap: 10 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseLabel: { color: marketing.mutedText, width: 56, fontSize: 11, fontWeight: '600' },
  pulseTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  pulseFill: { height: '100%', borderRadius: 4 },
  pulsePct: { width: 36, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  pulseHint: { color: marketing.mutedText, fontSize: 10, marginTop: 4 },
});
