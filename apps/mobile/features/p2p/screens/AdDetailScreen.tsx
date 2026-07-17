import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable, Share, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SkeletonList,
  PrimaryButton,
  ErrorBanner,
  ErrorState,
  TerminalPanel,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useP2PStore } from '@core/state/p2pStore';
import {
  adAvailabilityMessage,
  adAvailabilityState,
  adAutoReplyText,
  adPaymentWindowMinutes,
  adPremiumLabel,
  adSpreadValue,
  adTermsText,
  formatAdAvailable,
  formatAdLimits,
  formatAdPriceBlock,
  isUserBuyingFromAd,
  tradeActionLabel,
} from '@core/domain/p2p/adDetail';
import { parseAdPayments, marketplaceErrorMessage, spotPriceForCrypto } from '@core/domain/p2p/marketplace';
import { useGuestAccess } from '@features/auth';
import {
  useP2PAdDetail,
  useP2PReferencePrice,
  useSpotTickersForP2P,
  useBlockAdvertiser,
  P2PAdNotFoundError,
} from '../hooks/useP2P';
import { AdDetailMerchantCard } from '../components/AdDetailMerchantCard';
import { AdDetailPaymentMethods, AdDetailEscrowBanner } from '../components/AdDetailSections';
import { TakeOrderModal } from '../components/TakeOrderModal';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'AdDetail'>;

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { paddingVertical: theme.spacing[2], gap: theme.spacing[3] }]}>
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text
        style={[
          theme.typography.bodyMd,
          {
            color: accent ?? `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sansBold,
            flex: 1,
            textAlign: 'right',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function AdDetailScreen({ navigation, route }: Props) {
  const { adId, ad: seedAd } = route.params;
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const buyPalette = semanticStatusPalette(theme.colors, 'buy');
  const sellPalette = semanticStatusPalette(theme.colors, 'sell');
  const isOnline = useAppStore((s) => s.isOnline);
  const { isAuthenticated, requireAuth, openLogin } = useGuestAccess();
  const toggleFavorite = useP2PStore((s) => s.toggleFavorite);
  const favoriteAdIds = useP2PStore((s) => s.favoriteAdIds);
  const block = useBlockAdvertiser();

  const [showTrade, setShowTrade] = useState(false);
  const adQ = useP2PAdDetail(adId, seedAd);
  const tickersQ = useSpotTickersForP2P();

  const ad = adQ.data;
  const refQ = useP2PReferencePrice(ad?.crypto_symbol ?? '', ad?.fiat_currency ?? '');

  useEffect(() => {
    analytics.screen('S-601');
  }, []);

  const onRefresh = useCallback(() => {
    void adQ.refetch();
    void tickersQ.refetch();
    if (ad) void refQ.refetch();
  }, [adQ, tickersQ, refQ, ad]);

  const spotPrice = useMemo(() => {
    if (!ad) return null;
    const tickers = tickersQ.data ?? [];
    return spotPriceForCrypto(tickers, ad.crypto_symbol);
  }, [ad, tickersQ.data]);

  const referencePrice = useMemo(() => {
    const ref = refQ.data?.reference_price;
    if (ref) {
      const n = parseFloat(ref);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return spotPrice;
  }, [refQ.data, spotPrice]);

  const availability = adAvailabilityState(ad);
  const availabilityMsg = adAvailabilityMessage(availability);
  const isFavorite = favoriteAdIds.includes(adId);

  const shareAd = async () => {
    if (!ad) return;
    const price = formatAdPriceBlock(ad);
    await Share.share({
      message: `P2P ${ad.crypto_symbol}/${ad.fiat_currency} — ${price.sym}${price.formatted} via METHErium`,
    });
  };

  if (adQ.isLoading && !ad) {
    return (
      <ScreenLayout testID="S-601">
        <SkeletonList rows={10} />
      </ScreenLayout>
    );
  }

  if (adQ.isError || !ad) {
    const notFound = adQ.error instanceof P2PAdNotFoundError;
    const message = notFound
      ? 'This advertisement is unavailable or has been removed.'
      : marketplaceErrorMessage(adQ.error);
    return (
      <ScreenLayout testID="S-601">
        {!isOnline ? <ErrorBanner message="Offline — reconnect to refresh ad details." onRetry={onRefresh} /> : null}
        <ErrorState
          title={notFound ? 'Ad unavailable' : 'Could not load ad'}
          message={message}
          onRetry={onRefresh}
        />
      </ScreenLayout>
    );
  }

  const price = formatAdPriceBlock(ad);
  const limits = formatAdLimits(ad);
  const available = formatAdAvailable(ad);
  const payments = parseAdPayments(ad);
  const premium = adPremiumLabel(ad, referencePrice);
  const spread = adSpreadValue(ad, referencePrice);
  const terms = adTermsText(ad);
  const autoReply = adAutoReplyText(ad);
  const isBuy = isUserBuyingFromAd(ad);
  const tradePalette = isBuy ? buyPalette : sellPalette;
  const canTrade = availability === 'available' && isAuthenticated;
  const tickerFailed = tickersQ.isError && !tickersQ.data;

  return (
    <ScreenLayout testID="S-601">
      <ScrollView
        refreshControl={<RefreshControl refreshing={adQ.isFetching && !adQ.isLoading} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
      >
        {!isOnline ? <ErrorBanner message="Offline — details may be stale." onRetry={onRefresh} /> : null}
        {availabilityMsg ? <ErrorBanner message={availabilityMsg} /> : null}
        {tickerFailed ? (
          <View
            style={[
              styles.riskBanner,
              {
                backgroundColor: warning.bg,
                borderColor: warning.border,
                borderRadius: theme.radius.md,
                padding: theme.spacing[2.5],
                marginBottom: theme.spacing[3],
                gap: theme.spacing[2],
              },
            ]}
          >
            <Text style={[theme.typography.bodySm, styles.riskText, { color: warning.fg, flex: 1 }]}>
              Spot reference feed is reconnecting.
            </Text>
            <Pressable onPress={() => void tickersQ.refetch()}>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: warning.fg, fontFamily: theme.fonts.sansBold, textDecorationLine: 'underline' },
                ]}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.headerActions, { gap: theme.spacing[4], marginBottom: theme.spacing[2] }]}>
          <Pressable onPress={() => toggleFavorite(adId)} hitSlop={8} accessibilityLabel="Favorite merchant">
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={theme.sizes.iconMd}
              color={`hsl(${theme.colors.brandPrimary})`}
            />
          </Pressable>
          <Pressable onPress={() => void shareAd()} hitSlop={8} accessibilityLabel="Share ad">
            <Ionicons name="share-outline" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        </View>

        <Text
          style={[
            theme.typography.headingLg,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, letterSpacing: -0.2 },
          ]}
        >
          {ad.crypto_symbol} / {ad.fiat_currency}
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[3] },
          ]}
        >
          {isBuy ? 'You buy crypto' : 'You sell crypto'} · {ad.pricing_type === 'floating' ? 'Floating' : 'Fixed'} price
        </Text>

        <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
          <Text
            style={[
              theme.typography.displayMd,
              { color: tradePalette.fg, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {price.sym}
            {price.formatted}
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
          >
            per {ad.crypto_symbol}
          </Text>
          {premium ? (
            <Text
              style={[
                theme.typography.bodySm,
                {
                  color: `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: theme.fonts.sansSemiBold,
                  marginTop: theme.spacing[1.5],
                },
              ]}
            >
              {premium}
            </Text>
          ) : null}
        </TerminalPanel>

        <AdDetailEscrowBanner />

        <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
          <DetailRow label="Available" value={`${available.qty} ${available.crypto}`} />
          <DetailRow label="Limit" value={`${limits.sym}${limits.min} – ${limits.sym}${limits.max}`} />
          <DetailRow label="Payment window" value={`${adPaymentWindowMinutes(ad)} min`} />
          {referencePrice != null ? (
            <DetailRow
              label="Reference"
              value={`${price.sym}${referencePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            />
          ) : null}
          {spread != null ? (
            <DetailRow
              label="Spread"
              value={`${spread >= 0 ? '+' : ''}${spread.toFixed(2)} ${ad.fiat_currency}`}
              accent={spread >= 0 ? sellPalette.fg : buyPalette.fg}
            />
          ) : null}
        </TerminalPanel>

        <Text
          style={[
            theme.typography.headingSm,
            {
              color: `hsl(${theme.colors.foregroundPrimary})`,
              fontFamily: theme.fonts.sansBold,
              marginBottom: theme.spacing[2],
              marginTop: theme.spacing[1],
            },
          ]}
        >
          Merchant
        </Text>
        <AdDetailMerchantCard
          ad={ad}
          onPress={
            ad.user_id
              ? () => navigation.navigate('MerchantProfile', { advertiserId: ad.user_id! })
              : undefined
          }
        />

        <Text
          style={[
            theme.typography.headingSm,
            {
              color: `hsl(${theme.colors.foregroundPrimary})`,
              fontFamily: theme.fonts.sansBold,
              marginBottom: theme.spacing[2],
              marginTop: theme.spacing[1],
            },
          ]}
        >
          Payment methods
        </Text>
        <AdDetailPaymentMethods payments={payments} />

        {terms ? (
          <>
            <Text
              style={[
                theme.typography.headingSm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansBold,
                  marginBottom: theme.spacing[2],
                  marginTop: theme.spacing[1],
                },
              ]}
            >
              Terms & conditions
            </Text>
            <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{terms}</Text>
            </TerminalPanel>
          </>
        ) : null}

        {autoReply ? (
          <>
            <Text
              style={[
                theme.typography.headingSm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansBold,
                  marginBottom: theme.spacing[2],
                  marginTop: theme.spacing[1],
                },
              ]}
            >
              Auto reply
            </Text>
            <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{autoReply}</Text>
            </TerminalPanel>
          </>
        ) : null}

        <View style={[styles.actionRow, { gap: theme.spacing[2.5], marginBottom: theme.spacing[2] }]}>
          {isAuthenticated && ad.user_id ? (
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing[3],
                },
              ]}
              onPress={() => {
                void hapticLight();
                block.mutate(ad.user_id!);
                navigation.goBack();
              }}
            >
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                ]}
              >
                Block merchant
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!isAuthenticated ? (
          <>
            <PrimaryButton title={tradeActionLabel(ad)} onPress={() => openLogin()} style={{ marginTop: theme.spacing[2] }} />
            <Pressable onPress={() => openLogin()} style={{ marginTop: theme.spacing[2] }}>
              <Text
                style={[
                  theme.typography.bodyMd,
                  {
                    textAlign: 'center',
                    fontFamily: theme.fonts.sansBold,
                    color: `hsl(${theme.colors.brandPrimary})`,
                  },
                ]}
              >
                Log in to trade
              </Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton
            title={tradeActionLabel(ad)}
            disabled={!canTrade}
            onPress={() => {
              if (!requireAuth()) return;
              if (availability !== 'available') return;
              setShowTrade(true);
            }}
            style={{ marginTop: theme.spacing[2] }}
          />
        )}
      </ScrollView>

      {showTrade && isAuthenticated ? (
        <TakeOrderModal
          ad={ad}
          fiat={ad.fiat_currency}
          visible={showTrade}
          onClose={() => setShowTrade(false)}
          onCreated={(orderId) => {
            void adQ.refetch();
            navigation.navigate('OrderRoom', { orderId });
          }}
        />
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  riskText: {},
  actionRow: { flexDirection: 'row' },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
  },
});
