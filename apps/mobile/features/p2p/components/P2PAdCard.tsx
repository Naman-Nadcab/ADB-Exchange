import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { P2PAd } from '@exchange/mobile-types';
import { getAdPrice, getAdSide } from '@core/domain/p2p/order';

type Props = {
  ad: P2PAd;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export function P2PAdCard({ ad, onPress, isFavorite, onToggleFavorite }: Props) {
  const { theme } = useTheme();
  const side = getAdSide(ad);
  const price = getAdPrice(ad);
  const completion = ad.merchant_completion_rate ?? '—';
  const orders = ad.merchant_total_orders ?? ad.total_orders ?? 0;

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityLabel={`${side} ${ad.crypto_symbol}`}>
      <View style={styles.top}>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
          {ad.username} {ad.verified_merchant ? '✓' : ''}
        </Text>
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={8}>
            <Text>{isFavorite ? '★' : '☆'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
        {completion}% · {orders} orders
        {ad.merchant_avg_release_time_minutes ? ` · ~${ad.merchant_avg_release_time_minutes}m` : ''}
      </Text>
      <View style={styles.bottom}>
        <Text style={{ fontWeight: '600', color: side === 'sell' ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.tradeSell})` }}>
          {side.toUpperCase()} {ad.crypto_symbol}
        </Text>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
          {price} {ad.fiat_currency}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>
        Avail {ad.available_amount} · {ad.min_amount}–{ad.max_amount} {ad.fiat_currency}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, minHeight: 44 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
