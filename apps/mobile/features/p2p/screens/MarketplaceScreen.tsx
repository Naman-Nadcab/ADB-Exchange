import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  StyleSheet,
  RefreshControl,
  View,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SkeletonList,
  PrimaryButton,
  FilterChip,
  AccountEntryButton,
  ErrorState,
  EmptyState,
  ErrorBanner,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useGuestAccess } from '@features/auth';
import type { P2PAd } from '@exchange/mobile-types';
import {
  applyQuickChipFilters,
  computeP2pAverage,
  filterAdsByPaymentCode,
  filterAdsBySearch,
  formatFiatSymbol,
  parseNum,
  QUICK_CHIPS,
  spotPriceForCrypto,
  type QuickChipId,
  type MarketplaceFiltersValue,
  marketplaceErrorMessage,
} from '@core/domain/p2p/marketplace';
import { useP2PMarketplaceAds, useP2PSubscriptions, useSpotTickersForP2P } from '../hooks/useP2P';
import { MarketplaceFilters } from '../components/MarketplaceFilters';
import { P2PAdCard } from '../components/P2PAdCard';
import { TakeOrderModal } from '../components/TakeOrderModal';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'Marketplace'>;

const TOOLBAR = [
  { id: 'orders', label: 'Orders', icon: 'receipt-outline' as const },
  { id: 'ads', label: 'My Ads', icon: 'megaphone-outline' as const },
  { id: 'payments', label: 'Payments', icon: 'card-outline' as const },
];

const priceFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function MarketplaceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const buyPalette = semanticStatusPalette(theme.colors, 'buy');
  const sellPalette = semanticStatusPalette(theme.colors, 'sell');
  const isOnline = useAppStore((s) => s.isOnline);
  const { isAuthenticated, requireAuth, openLogin } = useGuestAccess();

  const [filters, setFilters] = useState<MarketplaceFiltersValue>({
    side: 'buy',
    crypto: 'USDT',
    fiat: 'INR',
    paymentCode: '',
  });
  const [search, setSearch] = useState('');
  const [activeChips, setActiveChips] = useState<Set<QuickChipId>>(() => new Set());
  const [modalAd, setModalAd] = useState<P2PAd | null>(null);

  useP2PSubscriptions();

  const adsQ = useP2PMarketplaceAds({
    type: filters.side,
    currency: filters.crypto,
    fiat: filters.fiat,
  });
  const tickersQ = useSpotTickersForP2P();

  useEffect(() => {
    analytics.screen('S-600');
  }, []);

  const sym = formatFiatSymbol(filters.fiat);
  const tickers = useMemo(() => tickersQ.data ?? [], [tickersQ.data]);
  const spotPrice = useMemo(() => spotPriceForCrypto(tickers, filters.crypto), [tickers, filters.crypto]);
  const tickerLoadFailed = tickersQ.isError && !tickersQ.data;

  const tickerCoins = useMemo(() => {
    return ['BTC_USDT', 'ETH_USDT']
      .map((symbol) => {
        const t = tickers.find((x) => x.symbol === symbol);
        if (!t) return null;
        return { symbol: symbol.split('_')[0]!, price: parseNum(t.last_price), chg: t.change_pct ?? null };
      })
      .filter(Boolean) as { symbol: string; price: number | null; chg: number | null }[];
  }, [tickers]);

  const filteredAds = useMemo(() => {
    const base = adsQ.data ?? [];
    let result = filterAdsByPaymentCode(base, filters.paymentCode);
    result = filterAdsBySearch(result, search);
    result = applyQuickChipFilters(result, activeChips);
    return result;
  }, [adsQ.data, filters.paymentCode, search, activeChips]);

  const p2pAvg = useMemo(() => computeP2pAverage(adsQ.data ?? []), [adsQ.data]);

  const toggleChip = useCallback((chip: QuickChipId) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }, []);

  const onRefresh = useCallback(() => {
    void adsQ.refetch();
    void tickersQ.refetch();
  }, [adsQ, tickersQ]);

  const onToolbar = (id: string) => {
    void hapticLight();
    if (!requireAuth()) return;
    if (id === 'orders') navigation.navigate('OrdersList');
    else if (id === 'ads') navigation.navigate('MyAds');
    else if (id === 'payments') navigation.navigate('PaymentMethods');
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.heroRow, { marginBottom: theme.spacing[2] }]}>
        <View style={{ flex: 1 }}>
          <View style={[styles.titleRow, { gap: theme.spacing[2.5] }]}>
            <Text
              style={[
                theme.typography.displayMd,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, letterSpacing: -0.3 },
              ]}
            >
              P2P Trading
            </Text>
            <View
              style={[
                styles.escrowBadge,
                {
                  backgroundColor: success.bg,
                  borderColor: success.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                  gap: theme.spacing[1],
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={theme.sizes.iconSm} color={success.fg} />
              <Text style={[theme.typography.labelSm, { color: success.fg, fontFamily: theme.fonts.sansBold }]}>Escrow</Text>
            </View>
          </View>
          {tickerCoins.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tickerStrip, { marginTop: theme.spacing[2] }]}>
              {tickerCoins.map(({ symbol, price, chg }) => {
                const up = chg != null && chg >= 0;
                return (
                  <View key={symbol} style={[styles.tickerItem, { gap: theme.spacing[1.5], marginRight: theme.spacing[4] }]}>
                    <Text
                      style={[
                        theme.typography.bodySm,
                        { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                      ]}
                    >
                      {symbol}
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySm,
                        { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                      ]}
                    >
                      {price != null ? `$${priceFmt.format(price)}` : '—'}
                    </Text>
                    {chg != null ? (
                      <Text
                        style={[
                          theme.typography.labelSm,
                          {
                            color: up ? buyPalette.fg : sellPalette.fg,
                            fontFamily: theme.fonts.sansSemiBold,
                          },
                        ]}
                      >
                        {chg > 0 ? '+' : ''}
                        {chg.toFixed(2)}%
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
        <AccountEntryButton />
      </View>

      {!isOnline ? (
        <ErrorBanner message="You're offline — showing last loaded ads if available." onRetry={onRefresh} />
      ) : null}

      <MarketplaceFilters value={filters} onChange={setFilters} onRefresh={onRefresh} />

      {tickerLoadFailed ? (
        <View
          style={[
            styles.riskBanner,
            {
              backgroundColor: warning.bg,
              borderColor: warning.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              marginBottom: theme.spacing[2],
              gap: theme.spacing[2],
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, styles.riskText, { color: warning.fg, flex: 1 }]}>
            Spot reference feed is reconnecting. P2P listing remains available.
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

      <View style={[styles.contextRow, { gap: theme.spacing[2], marginBottom: theme.spacing[2] }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { gap: theme.spacing[2], paddingVertical: theme.spacing[1] }]}>
          {QUICK_CHIPS.map(({ id, label }) => (
            <FilterChip
              key={id}
              label={label}
              selected={activeChips.has(id)}
              onPress={() => toggleChip(id)}
            />
          ))}
        </ScrollView>
        <View style={[styles.contextStats, { gap: theme.spacing[3] }]}>
          {spotPrice != null ? (
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Spot{' '}
              <Text style={{ fontFamily: theme.fonts.sansBold, color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {sym}
                {priceFmt.format(spotPrice)}
              </Text>
            </Text>
          ) : null}
          {p2pAvg != null ? (
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              P2P Avg{' '}
              <Text style={{ fontFamily: theme.fonts.sansBold, color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {sym}
                {priceFmt.format(p2pAvg)}
              </Text>
            </Text>
          ) : null}
          {!adsQ.isLoading ? (
            <View
              style={[
                styles.adCount,
                {
                  backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.labelSm,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                ]}
              >
                {filteredAds.length} ad{filteredAds.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search merchant or coin" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.toolbar, { marginBottom: theme.spacing[2.5] }]}>
        {TOOLBAR.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onToolbar(item.id)}
            style={[
              styles.toolBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[2],
                marginRight: theme.spacing[2],
                gap: theme.spacing[1.5],
                minHeight: theme.listDensity.default.rowHeight - 20,
              },
            ]}
          >
            <Ionicons name={item.icon} size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {adsQ.isLoading ? <SkeletonList rows={6} /> : null}
      {adsQ.isError ? (
        <ErrorState
          title="Could not load ads"
          message={marketplaceErrorMessage(adsQ.error)}
          onRetry={onRefresh}
        />
      ) : null}
    </View>
  );

  return (
    <ScreenLayout testID="S-600">
      <FlatList
        data={adsQ.isLoading || adsQ.isError ? [] : filteredAds}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <P2PAdCard
            ad={item}
            fiat={filters.fiat}
            authed={isAuthenticated}
            spotPrice={spotPrice}
            onPress={() => navigation.navigate('AdDetail', { adId: item.id, ad: item })}
            onTrade={() => setModalAd(item)}
            onMerchantPress={
              item.user_id
                ? () => navigation.navigate('MerchantProfile', { advertiserId: item.user_id! })
                : undefined
            }
            onLoginPress={() => openLogin()}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !adsQ.isLoading && !adsQ.isError ? (
            <EmptyState
              title="No ads match your filters"
              message="Try another asset, fiat, or payment method. Pull down to refresh."
              actionLabel="Post Ad"
              onAction={() => {
                if (!requireAuth()) return;
                navigation.navigate('PostAdType');
              }}
              icon="storefront-outline"
            />
          ) : null
        }
        refreshControl={<RefreshControl refreshing={adsQ.isFetching && !adsQ.isLoading} onRefresh={onRefresh} />}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={7}
        initialNumToRender={10}
        contentContainerStyle={{ paddingBottom: 16 }}
      />

      <PrimaryButton
        title="Post Ad"
        onPress={() => {
          if (!requireAuth()) return;
          navigation.navigate('PostAdType');
        }}
        style={{ marginTop: 8 }}
      />

      {modalAd && isAuthenticated ? (
        <TakeOrderModal
          ad={modalAd}
          fiat={filters.fiat}
          visible={!!modalAd}
          onClose={() => setModalAd(null)}
          onCreated={(orderId) => {
            void adsQ.refetch();
            navigation.navigate('OrderRoom', { orderId });
          }}
        />
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  escrowBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  tickerStrip: { maxHeight: 28 },
  tickerItem: { flexDirection: 'row', alignItems: 'center' },
  riskBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderWidth: 1 },
  riskText: {},
  contextRow: {},
  chipRow: {},
  contextStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  adCount: {},
  toolbar: { maxHeight: 44 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
