import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, useTheme, hsl } from '@shared/theme';
import { ExchangeCard, PillTabBar } from '@shared/ui';
import type { Announcement, MarketListItem } from '@exchange/mobile-types';
import { formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';

type Props = {
  news: Announcement[];
  announcements: Announcement[];
  newListings: MarketListItem[];
  bullishPct: number;
  bearishPct: number;
  onSelectPair: (symbol: string) => void;
  onSelectAnnouncement?: (id: string) => void;
  onViewAllAnnouncements?: () => void;
};

export function MarketsIntelligencePanel({
  news,
  announcements,
  newListings,
  bullishPct,
  bearishPct,
  onSelectPair,
  onSelectAnnouncement,
  onViewAllAnnouncements,
}: Props) {
  const { theme } = useTheme();
  const m = theme.marketing;
  const buy = hsl(theme.colors.tradeBuy);
  const sell = hsl(theme.colors.tradeSell);
  const [tab, setTab] = useState<'news' | 'announcements' | 'listings' | 'pulse'>('news');
  const items =
    tab === 'news' ? news : tab === 'announcements' ? announcements : tab === 'listings' ? [] : [];

  return (
    <ExchangeCard variant="marketing" style={{ marginBottom: theme.spacing[3.5] }}>
      <View style={[styles.header, { gap: theme.spacing[2], marginBottom: theme.spacing[2.5] }]}>
        <Ionicons name="newspaper-outline" size={theme.sizes.iconSm} color={m.gold} />
        <Text
          style={[
            theme.typography.bodyLg,
            { color: '#FFF', fontFamily: theme.fonts.sansBold },
          ]}
        >
          Market Intelligence
        </Text>
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
        <View style={[styles.pulse, { marginTop: theme.spacing[3], gap: theme.spacing[2.5] }]}>
          <PulseBar label="Bullish" pct={bullishPct} color={buy} />
          <PulseBar label="Bearish" pct={bearishPct} color={sell} />
          <Text style={[theme.typography.labelSm, { color: m.mutedText, marginTop: theme.spacing[1] }]}>
            Based on 24H price direction across all pairs
          </Text>
        </View>
      ) : tab === 'listings' ? (
        <View style={[styles.list, { marginTop: theme.spacing[2.5], gap: theme.spacing[2] }]}>
          {newListings.length === 0 ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: m.mutedText, textAlign: 'center', paddingVertical: theme.spacing[4] },
              ]}
            >
              No new listings
            </Text>
          ) : (
            newListings.slice(0, 6).map((item) => (
              <Pressable
                key={item.symbol}
                style={[styles.listingRow, { paddingVertical: theme.spacing[2] }]}
                onPress={() => {
                  void hapticLight();
                  onSelectPair(item.symbol);
                }}
              >
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: '#FFF', fontFamily: theme.fonts.sansBold },
                  ]}
                >
                  {item.baseAsset}/{item.quoteAsset}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySm,
                    {
                      color: changeColorKey(item.changePct) === 'buy' ? buy : sell,
                      fontFamily: theme.fonts.sansBold,
                    },
                  ]}
                >
                  {formatChangePct(item.changePct)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <View style={[styles.list, { marginTop: theme.spacing[2.5], gap: theme.spacing[2] }]}>
          {items.length === 0 ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: m.mutedText, textAlign: 'center', paddingVertical: theme.spacing[4] },
              ]}
            >
              No {tab} available
            </Text>
          ) : (
            items.slice(0, 6).map((item, idx) => (
              <Pressable
                key={item.id ?? `${item.title}-${idx}`}
                style={[
                  styles.newsRow,
                  {
                    paddingVertical: theme.spacing[1.5],
                    borderBottomColor: m.insetHighlight,
                  },
                ]}
                onPress={() => {
                  if ((tab === 'news' || tab === 'announcements') && item.id && onSelectAnnouncement) {
                    void hapticLight();
                    onSelectAnnouncement(item.id);
                  }
                }}
                disabled={!(tab === 'news' || tab === 'announcements') || !item.id || !onSelectAnnouncement}
              >
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: '#FFF', fontFamily: theme.fonts.sansSemiBold },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.summary ? (
                  <Text
                    style={[
                      theme.typography.labelMd,
                      { color: m.mutedText, marginTop: theme.spacing[1] },
                    ]}
                    numberOfLines={2}
                  >
                    {item.summary}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
          {(tab === 'news' || tab === 'announcements') && onViewAllAnnouncements ? (
            <Pressable onPress={onViewAllAnnouncements} style={{ paddingTop: theme.spacing[2.5], alignItems: 'flex-end' }}>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: m.gold, fontFamily: theme.fonts.sansBold },
                ]}
              >
                View all
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ExchangeCard>
  );
}

function PulseBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const { theme } = useTheme();
  const m = theme.marketing;

  return (
    <View style={[styles.pulseRow, { gap: theme.spacing[2] }]}>
      <Text
        style={[
          theme.typography.labelMd,
          { color: m.mutedText, width: 56, fontFamily: theme.fonts.sansSemiBold },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.pulseTrack,
          {
            borderRadius: theme.radius.sm,
            backgroundColor: m.insetHighlight,
          },
        ]}
      >
        <View style={[styles.pulseFill, { width: `${pct}%`, backgroundColor: color, borderRadius: theme.radius.sm }]} />
      </View>
      <Text
        style={[
          theme.typography.labelMd,
          { color, width: 36, textAlign: 'right', fontFamily: theme.fonts.sansBold },
        ]}
      >
        {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  list: {},
  newsRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  listingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pulse: {},
  pulseRow: { flexDirection: 'row', alignItems: 'center' },
  pulseTrack: { flex: 1, height: 8, overflow: 'hidden' },
  pulseFill: { height: '100%' },
});
