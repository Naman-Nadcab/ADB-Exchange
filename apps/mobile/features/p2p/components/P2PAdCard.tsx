import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, MerchantBadge, StatusChip } from '@shared/ui';
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
  const sideColor = side === 'sell' ? theme.colors.tradeBuy : theme.colors.tradeSell;

  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      accessibilityLabel={`${side} ${ad.crypto_symbol}`}
    >
      <TerminalPanel style={styles.card}>
        <View style={styles.top}>
          <View style={styles.merchant}>
            <View style={[styles.avatar, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)` }]}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '800', fontSize: 12 }}>
                {ad.username.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View>
              <View style={styles.nameRow}>
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 14 }}>
                  {ad.username}
                </Text>
                {ad.verified_merchant ? <MerchantBadge completionRate={Number(completion) || 0} verified /> : null}
              </View>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 2 }}>
                {completion}% · {orders} orders
                {ad.merchant_avg_release_time_minutes ? ` · ~${ad.merchant_avg_release_time_minutes}m` : ''}
              </Text>
            </View>
          </View>
          {onToggleFavorite ? (
            <Pressable onPress={onToggleFavorite} hitSlop={8}>
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={18}
                color={`hsl(${theme.colors.brandPrimary})`}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.mid}>
          <StatusChip label={side === 'sell' ? 'Buy' : 'Sell'} tone={side === 'sell' ? 'live' : 'off'} />
          <Text style={{ fontWeight: '800', fontSize: 18, color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {price} <Text style={{ fontSize: 12, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>{ad.fiat_currency}</Text>
          </Text>
        </View>

        <View style={[styles.limits, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>
            Avail {ad.available_amount} {ad.crypto_symbol}
          </Text>
          <Text style={{ fontSize: 11, color: `hsl(${sideColor})`, fontWeight: '600' }}>
            {ad.min_amount}–{ad.max_amount} {ad.fiat_currency}
          </Text>
        </View>
      </TerminalPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  merchant: { flexDirection: 'row', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  mid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  limits: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
