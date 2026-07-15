import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { TerminalPanel, MerchantBadge } from '@shared/ui';
import type { P2PAd } from '@exchange/mobile-types';
import { getAdPrice, getAdSide } from '@core/domain/p2p/order';
import {
  formatFiatSymbol,
  formatP2pFiatPrice,
  formatP2pCryptoQty,
  parseAdPayments,
  paymentMethodChipTone,
  isUserBuyingFromAd,
  tradeActionLabel,
  computePremiumPct,
  formatPremiumLabel,
  parseNum,
} from '@core/domain/p2p/marketplace';

type Props = {
  ad: P2PAd;
  fiat: string;
  authed: boolean;
  spotPrice?: number | null;
  onPress: () => void;
  onTrade: () => void;
  onMerchantPress?: () => void;
  onLoginPress?: () => void;
};

function chipColors(tone: ReturnType<typeof paymentMethodChipTone>) {
  if (tone === 'bank') return { bg: 'rgba(14, 203, 129, 0.08)', text: '#0ecb81', border: 'rgba(14, 203, 129, 0.15)' };
  if (tone === 'upi') return { bg: 'rgba(245, 158, 11, 0.08)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.15)' };
  if (tone === 'imps') return { bg: 'rgba(59, 130, 246, 0.08)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.15)' };
  return {
    bg: 'rgba(128,128,128,0.12)',
    text: '#888',
    border: 'rgba(128,128,128,0.2)',
  };
}

export const P2PAdCard = memo(function P2PAdCard({
  ad,
  fiat,
  authed,
  spotPrice,
  onPress,
  onTrade,
  onMerchantPress,
  onLoginPress,
}: Props) {
  const { theme } = useTheme();
  const sym = formatFiatSymbol(fiat);
  const side = getAdSide(ad);
  const rawPrice = getAdPrice(ad);
  const priceShown = formatP2pFiatPrice(rawPrice, fiat);
  const minF = formatP2pFiatPrice(ad.min_amount ?? '0', fiat);
  const maxF = formatP2pFiatPrice(ad.max_amount ?? '0', fiat);
  const avail = formatP2pCryptoQty(ad.available_amount);
  const payments = parseAdPayments(ad);
  const verified = Boolean(ad.verified_merchant);
  const completion = ad.merchant_completion_rate != null ? `${ad.merchant_completion_rate}%` : '—';
  const orders = ad.merchant_total_orders ?? ad.total_orders ?? 0;
  const releaseMin = ad.merchant_avg_release_time_minutes;
  const isBuy = isUserBuyingFromAd(ad);
  const tradeColor = isBuy ? '#0ecb81' : '#f6465d';
  const priceColor = isBuy ? '#0ecb81' : '#f6465d';
  const adPriceNum = parseNum(rawPrice);
  const premiumLabel = formatPremiumLabel(
    adPriceNum != null ? computePremiumPct(adPriceNum, spotPrice ?? null) : null,
  );

  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      accessibilityLabel={`${side} ${ad.crypto_symbol} ${ad.username}`}
    >
      <TerminalPanel style={styles.card}>
        <View style={styles.top}>
          <Pressable
            style={styles.merchant}
            onPress={(e) => {
              e.stopPropagation?.();
              if (onMerchantPress) {
                void hapticLight();
                onMerchantPress();
              }
            }}
            disabled={!onMerchantPress}
          >
            <View style={[styles.avatar, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)` }]}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '800', fontSize: 13 }}>
                {(ad.username || 'M').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.merchantMeta}>
              <View style={styles.nameRow}>
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 14 }}>
                  {ad.username || 'Merchant'}
                </Text>
                {verified ? <MerchantBadge completionRate={Number(ad.merchant_completion_rate) || 0} verified /> : null}
              </View>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 2 }}>
                {orders} orders · {completion}
                {releaseMin ? ` · ~${releaseMin}m release` : ''}
              </Text>
            </View>
          </Pressable>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {ad.crypto_symbol}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={{ fontWeight: '800', fontSize: 20, color: priceColor }}>
              {sym}
              {priceShown}
              <Text style={{ fontSize: 12, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>
                {' '}
                /{ad.crypto_symbol}
              </Text>
            </Text>
            {premiumLabel ? (
              <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
                {premiumLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={[styles.statValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {avail} {ad.crypto_symbol}
            </Text>
          </View>
          <View>
            <Text style={styles.statLabel}>Limit</Text>
            <Text style={[styles.statValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {sym}
              {minF} – {sym}
              {maxF}
            </Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.chips}>
            {payments.length > 0 ? (
              payments.map((p, i) => {
                const c = chipColors(paymentMethodChipTone(p));
                return (
                  <View key={`${p}-${i}`} style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: c.text }}>{p}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>—</Text>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                if (!authed) {
                  onLoginPress?.();
                  return;
                }
                void hapticLight();
                onTrade();
              }}
              style={[styles.tradeBtn, { backgroundColor: tradeColor, opacity: authed ? 1 : 0.55 }]}
              accessibilityLabel={tradeActionLabel(ad)}
            >
              <Text style={styles.tradeBtnText}>{tradeActionLabel(ad)}</Text>
            </Pressable>
            {!authed ? (
              <Pressable onPress={onLoginPress}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.brandPrimary})`, textAlign: 'center' }}>
                  Log in to trade
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </TerminalPanel>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  merchant: { flexDirection: 'row', gap: 10, flex: 1 },
  merchantMeta: { flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceRow: { marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '500' },
  statValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  bottom: { marginTop: 14, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  actions: { gap: 6 },
  tradeBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
