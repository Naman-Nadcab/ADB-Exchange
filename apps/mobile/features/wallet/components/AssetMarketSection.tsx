import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, SkeletonList, EmptyState, ErrorState, PriceLabel, ChangeLabel } from '@shared/ui';
import { formatUsd } from '@core/domain/wallet/portfolio';
import { formatMarketCap } from '@core/domain/wallet/assetDetail';
import type { CoinInfo } from '@exchange/mobile-types';
import type { SpotTicker } from '@exchange/mobile-types';

type Props = {
  ticker?: SpotTicker | null;
  coinInfo?: CoinInfo | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600' }}>
        {label}
      </Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 13 }}>
        {value}
      </Text>
    </View>
  );
}

export function AssetMarketSection({ ticker, coinInfo, loading, error, onRetry }: Props) {
  const { theme } = useTheme();
  const price = ticker?.last_price ? parseFloat(ticker.last_price) : coinInfo?.current_price ?? null;
  const change = ticker?.change_pct ?? coinInfo?.price_change_percentage_24h ?? null;
  const high = ticker?.high_24h ? parseFloat(ticker.high_24h) : null;
  const low = ticker?.low_24h ? parseFloat(ticker.low_24h) : null;
  const volume = ticker?.volume_24h ? parseFloat(ticker.volume_24h) : coinInfo?.total_volume ?? null;
  const explorer = coinInfo?.blockchain_site?.trim() || null;
  const website = coinInfo?.homepage?.trim() || null;

  const openLink = (url: string) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    void Linking.openURL(href);
  };

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>MARKET INFO</Text>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error && !ticker && !coinInfo ? (
        <ErrorState title="Market data unavailable" onRetry={onRetry} />
      ) : !ticker && !coinInfo ? (
        <EmptyState title="No market data" message="Live price and market stats are unavailable for this asset." />
      ) : (
        <>
          <View style={styles.priceRow}>
            {price != null ? <PriceLabel value={price} size="md" /> : null}
            {change != null ? <ChangeLabel changePct={change} /> : null}
          </View>

          <View style={styles.grid}>
            <Stat label="24H High" value={high != null ? `$${formatUsd(high)}` : '—'} />
            <Stat label="24H Low" value={low != null ? `$${formatUsd(low)}` : '—'} />
            <Stat label="24H Volume" value={volume != null ? formatMarketCap(volume) : '—'} />
            <Stat label="Market Cap" value={formatMarketCap(coinInfo?.market_cap)} />
          </View>

          {(explorer || website) ? (
            <View style={[styles.links, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
              {website ? (
                <Pressable style={styles.linkBtn} onPress={() => openLink(website)}>
                  <Ionicons name="globe-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
                  <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
                    Website
                  </Text>
                </Pressable>
              ) : null}
              {explorer ? (
                <Pressable style={styles.linkBtn} onPress={() => openLink(explorer)}>
                  <Ionicons name="open-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
                  <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>
                    Explorer
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '47%', gap: 2, paddingVertical: 4 },
  links: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
