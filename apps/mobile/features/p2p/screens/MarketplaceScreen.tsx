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
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.heroTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>P2P Trading</Text>
            <View style={styles.escrowBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#0ecb81" />
              <Text style={styles.escrowText}>Escrow</Text>
            </View>
          </View>
          {tickerCoins.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tickerStrip}>
              {tickerCoins.map(({ symbol, price, chg }) => {
                const up = chg != null && chg >= 0;
                return (
                  <View key={symbol} style={styles.tickerItem}>
                    <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12 }}>
                      {symbol}
                    </Text>
                    <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12 }}>
                      {price != null ? `$${priceFmt.format(price)}` : '—'}
                    </Text>
                    {chg != null ? (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: up ? '#0ecb81' : '#f6465d' }}>
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
        <View style={styles.riskBanner}>
          <Text style={styles.riskText}>
            Spot reference feed is reconnecting. P2P listing remains available.
          </Text>
          <Pressable onPress={() => void tickersQ.refetch()}>
            <Text style={styles.riskRetry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.contextRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {QUICK_CHIPS.map(({ id, label }) => (
            <FilterChip
              key={id}
              label={label}
              selected={activeChips.has(id)}
              onPress={() => toggleChip(id)}
            />
          ))}
        </ScrollView>
        <View style={styles.contextStats}>
          {spotPrice != null ? (
            <Text style={[styles.contextText, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Spot{' '}
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {sym}
                {priceFmt.format(spotPrice)}
              </Text>
            </Text>
          ) : null}
          {p2pAvg != null ? (
            <Text style={[styles.contextText, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              P2P Avg{' '}
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {sym}
                {priceFmt.format(p2pAvg)}
              </Text>
            </Text>
          ) : null}
          {!adsQ.isLoading ? (
            <View style={[styles.adCount, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {filteredAds.length} ad{filteredAds.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search merchant or coin" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
        {TOOLBAR.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onToolbar(item.id)}
            style={[
              styles.toolBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              },
            ]}
          >
            <Ionicons name={item.icon} size={16} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>
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
            onPress={() => navigation.navigate('AdDetail', { adId: item.id })}
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
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14, 203, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 203, 129, 0.2)',
  },
  escrowText: { fontSize: 11, fontWeight: '700', color: '#0ecb81' },
  tickerStrip: { marginTop: 8, maxHeight: 28 },
  tickerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 16 },
  riskBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  riskText: { flex: 1, fontSize: 12, color: '#d97706' },
  riskRetry: { fontSize: 12, fontWeight: '700', color: '#d97706', textDecorationLine: 'underline' },
  contextRow: { gap: 8, marginBottom: 8 },
  chipRow: { gap: 8, paddingVertical: 4 },
  contextStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  contextText: { fontSize: 12 },
  adCount: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  toolbar: { marginBottom: 10, maxHeight: 44 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 36,
  },
});
