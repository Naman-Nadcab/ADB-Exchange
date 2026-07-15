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
  theme,
  accent,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  accent?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: accent ?? `hsl(${theme.colors.foregroundPrimary})`,
          fontWeight: '700',
          fontSize: 14,
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function AdDetailScreen({ navigation, route }: Props) {
  const { adId, ad: seedAd } = route.params;
  const { theme } = useTheme();
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
  const tradeColor = isBuy ? '#0ecb81' : '#f6465d';
  const canTrade = availability === 'available' && isAuthenticated;
  const tickerFailed = tickersQ.isError && !tickersQ.data;

  return (
    <ScreenLayout testID="S-601">
      <ScrollView
        refreshControl={<RefreshControl refreshing={adQ.isFetching && !adQ.isLoading} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {!isOnline ? <ErrorBanner message="Offline — details may be stale." onRetry={onRefresh} /> : null}
        {availabilityMsg ? <ErrorBanner message={availabilityMsg} /> : null}
        {tickerFailed ? (
          <View style={styles.riskBanner}>
            <Text style={styles.riskText}>Spot reference feed is reconnecting.</Text>
            <Pressable onPress={() => void tickersQ.refetch()}>
              <Text style={styles.riskRetry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.headerActions}>
          <Pressable onPress={() => toggleFavorite(adId)} hitSlop={8} accessibilityLabel="Favorite merchant">
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={22}
              color={`hsl(${theme.colors.brandPrimary})`}
            />
          </Pressable>
          <Pressable onPress={() => void shareAd()} hitSlop={8} accessibilityLabel="Share ad">
            <Ionicons name="share-outline" size={22} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        </View>

        <Text style={[styles.pairTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {ad.crypto_symbol} / {ad.fiat_currency}
        </Text>
        <Text style={{ fontSize: 13, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>
          {isBuy ? 'You buy crypto' : 'You sell crypto'} · {ad.pricing_type === 'floating' ? 'Floating' : 'Fixed'} price
        </Text>

        <TerminalPanel style={styles.pricePanel}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: tradeColor }}>
            {price.sym}
            {price.formatted}
          </Text>
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }}>
            per {ad.crypto_symbol}
          </Text>
          {premium ? (
            <Text style={{ fontSize: 13, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 6 }}>
              {premium}
            </Text>
          ) : null}
        </TerminalPanel>

        <AdDetailEscrowBanner />

        <TerminalPanel style={{ marginBottom: 12 }}>
          <DetailRow label="Available" value={`${available.qty} ${available.crypto}`} theme={theme} />
          <DetailRow
            label="Limit"
            value={`${limits.sym}${limits.min} – ${limits.sym}${limits.max}`}
            theme={theme}
          />
          <DetailRow label="Payment window" value={`${adPaymentWindowMinutes(ad)} min`} theme={theme} />
          {referencePrice != null ? (
            <DetailRow
              label="Reference"
              value={`${price.sym}${referencePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              theme={theme}
            />
          ) : null}
          {spread != null ? (
            <DetailRow
              label="Spread"
              value={`${spread >= 0 ? '+' : ''}${spread.toFixed(2)} ${ad.fiat_currency}`}
              theme={theme}
              accent={spread >= 0 ? '#f6465d' : '#0ecb81'}
            />
          ) : null}
        </TerminalPanel>

        <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Merchant</Text>
        <AdDetailMerchantCard
          ad={ad}
          onPress={
            ad.user_id
              ? () => navigation.navigate('MerchantProfile', { advertiserId: ad.user_id! })
              : undefined
          }
        />

        <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Payment methods</Text>
        <AdDetailPaymentMethods payments={payments} />

        {terms ? (
          <>
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Terms & conditions</Text>
            <TerminalPanel style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: `hsl(${theme.colors.foregroundPrimary})` }}>{terms}</Text>
            </TerminalPanel>
          </>
        ) : null}

        {autoReply ? (
          <>
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Auto reply</Text>
            <TerminalPanel style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: `hsl(${theme.colors.foregroundPrimary})` }}>{autoReply}</Text>
            </TerminalPanel>
          </>
        ) : null}

        <View style={styles.actionRow}>
          {isAuthenticated && ad.user_id ? (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
              onPress={() => {
                void hapticLight();
                block.mutate(ad.user_id!);
                navigation.goBack();
              }}
            >
              <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>Block merchant</Text>
            </Pressable>
          ) : null}
        </View>

        {!isAuthenticated ? (
          <>
            <PrimaryButton title={tradeActionLabel(ad)} onPress={() => openLogin()} style={{ marginTop: 8 }} />
            <Pressable onPress={() => openLogin()} style={{ marginTop: 8 }}>
              <Text style={{ textAlign: 'center', fontWeight: '700', color: `hsl(${theme.colors.brandPrimary})` }}>
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
            style={{ marginTop: 8 }}
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
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 8 },
  pairTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  pricePanel: { marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  riskText: { flex: 1, fontSize: 12, color: '#d97706' },
  riskRetry: { fontSize: 12, fontWeight: '700', color: '#d97706', textDecorationLine: 'underline' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
