import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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

function paymentChipPalette(
  colors: ReturnType<typeof useTheme>['theme']['colors'],
  tone: ReturnType<typeof paymentMethodChipTone>,
) {
  if (tone === 'bank') return semanticStatusPalette(colors, 'buy');
  if (tone === 'upi') return semanticStatusPalette(colors, 'warning');
  if (tone === 'imps') return semanticStatusPalette(colors, 'info');
  return semanticStatusPalette(colors, 'muted');
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
  const tradePalette = semanticStatusPalette(theme.colors, isBuy ? 'buy' : 'sell');
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
      <TerminalPanel style={{ marginBottom: theme.spacing[2.5] }}>
        <View style={styles.top}>
          <Pressable
            style={[styles.merchant, { gap: theme.spacing[2.5] }]}
            onPress={(e) => {
              e.stopPropagation?.();
              if (onMerchantPress) {
                void hapticLight();
                onMerchantPress();
              }
            }}
            disabled={!onMerchantPress}
          >
            <View
              style={[
                styles.avatar,
                {
                  width: theme.sizes.tapTarget,
                  height: theme.sizes.tapTarget,
                  borderRadius: theme.radius.full,
                  backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)`,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold },
                ]}
              >
                {(ad.username || 'M').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.merchantMeta}>
              <View style={[styles.nameRow, { gap: theme.spacing[1.5] }]}>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                  ]}
                >
                  {ad.username || 'Merchant'}
                </Text>
                {verified ? <MerchantBadge completionRate={Number(ad.merchant_completion_rate) || 0} verified /> : null}
              </View>
              <Text
                style={[
                  theme.typography.labelSm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
                ]}
              >
                {orders} orders · {completion}
                {releaseMin ? ` · ~${releaseMin}m release` : ''}
              </Text>
            </View>
          </Pressable>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {ad.crypto_symbol}
          </Text>
        </View>

        <View style={{ marginTop: theme.spacing[3] }}>
          <Text
            style={[
              theme.typography.displayMd,
              { color: tradePalette.fg, fontFamily: theme.fonts.sansBold, fontSize: 20, lineHeight: 26 },
            ]}
          >
            {sym}
            {priceShown}
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              {' '}
              /{ad.crypto_symbol}
            </Text>
          </Text>
          {premiumLabel ? (
            <Text
              style={[
                theme.typography.labelSm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              {premiumLabel}
            </Text>
          ) : null}
        </View>

        <View style={[styles.statsRow, { gap: theme.spacing[6], marginTop: theme.spacing[3] }]}>
          <View>
            <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Available</Text>
            <Text
              style={[
                theme.typography.bodySm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansSemiBold,
                  marginTop: theme.spacing[0.5],
                },
              ]}
            >
              {avail} {ad.crypto_symbol}
            </Text>
          </View>
          <View>
            <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Limit</Text>
            <Text
              style={[
                theme.typography.bodySm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansSemiBold,
                  marginTop: theme.spacing[0.5],
                },
              ]}
            >
              {sym}
              {minF} – {sym}
              {maxF}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: theme.spacing[3.5], gap: theme.spacing[2.5] }}>
          <View style={[styles.chips, { gap: theme.spacing[1.5] }]}>
            {payments.length > 0 ? (
              payments.map((p, i) => {
                const c = paymentChipPalette(theme.colors, paymentMethodChipTone(p));
                return (
                  <View
                    key={`${p}-${i}`}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: c.bg,
                        borderColor: c.border,
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: theme.spacing[2],
                        paddingVertical: theme.spacing[1],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.labelSm,
                        { color: c.fg, fontFamily: theme.fonts.sansSemiBold },
                      ]}
                    >
                      {p}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>—</Text>
            )}
          </View>
          <View style={{ gap: theme.spacing[1.5] }}>
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
              style={[
                styles.tradeBtn,
                {
                  backgroundColor: tradePalette.fg,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing[2.5],
                  opacity: authed ? 1 : 0.55,
                },
              ]}
              accessibilityLabel={tradeActionLabel(ad)}
            >
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: `hsl(${theme.colors.destructiveForeground})`, fontFamily: theme.fonts.sansBold },
                ]}
              >
                {tradeActionLabel(ad)}
              </Text>
            </Pressable>
            {!authed ? (
              <Pressable onPress={onLoginPress}>
                <Text
                  style={[
                    theme.typography.labelSm,
                    {
                      color: `hsl(${theme.colors.brandPrimary})`,
                      fontFamily: theme.fonts.sansBold,
                      textAlign: 'center',
                    },
                  ]}
                >
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  merchant: { flexDirection: 'row', flex: 1 },
  merchantMeta: { flex: 1, minWidth: 0 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  statsRow: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1 },
  tradeBtn: { alignItems: 'center' },
});
