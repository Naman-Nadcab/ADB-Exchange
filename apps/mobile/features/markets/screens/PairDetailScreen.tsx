import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  PrimaryButton,
  SkeletonList,
  EmptyState,
  ErrorBanner,
  TerminalPanel,
  PriceFlashText,
  ChangeLabel,
  CandleChart,
  CHART_INTERVALS,
  PillTabBar,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { formatPrice, changeColorKey, formatVolume, formatMarketCap } from '@core/domain/markets/formatPrice';
import { relatedPairs } from '@core/domain/markets/marketUtils';
import { useTicker, useMarkets } from '../hooks/useMarkets';
import { useTickerSubscription } from '../hooks/useTickerSubscription';
import { useRecentMarkets } from '../hooks/useRecentMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';
import { Sparkline, sparklineFromChange } from '../components/Sparkline';
import { usePairCandles } from '../hooks/usePairCandles';
import { usePairMarketPreview } from '../hooks/usePairMarketPreview';
import { useMarketsCoinInfo } from '../hooks/useMarketsCoinInfo';
import { enrichWithIntelligence, useMarketIntelligence } from '../hooks/useMarketIntelligence';
import { CoinAboutSection } from '../components/CoinAboutSection';
import { RelatedPairsSection } from '../components/RelatedPairsSection';
import { OrderbookPreview } from '../components/OrderbookPreview';
import { RecentTradesPreview } from '../components/RecentTradesPreview';
import { useGuestAccess } from '@features/auth';
import type { MarketsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'PairDetail'>;

export function PairDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const { theme } = useTheme();
  const { requireAuth } = useGuestAccess();
  const [chartInterval, setChartInterval] = useState(3600);
  const { data, isLoading, isError, refetch, isFetching } = useTicker(symbol);
  const { data: allMarkets } = useMarkets();
  const { data: intelligence } = useMarketIntelligence();
  const { addRecent } = useRecentMarkets();
  const { toggle, isFavorite } = useFavorites();
  const live = useMarketDataStore((s) => s.live[normalizeSymbol(symbol)]);
  const { data: candles, isLoading: candlesLoading } = usePairCandles(symbol, chartInterval);
  const { orderbook, trades, isLoading: previewLoading, refetch: refetchPreview } = usePairMarketPreview(symbol);
  const coinQ = useMarketsCoinInfo(data?.base_asset ?? '');

  useTickerSubscription(symbol);

  useEffect(() => {
    analytics.screen('S-202');
    addRecent(symbol);
  }, [symbol, addRecent]);

  const intelItem = useMemo(() => {
    const items = enrichWithIntelligence(allMarkets ?? [], intelligence);
    return items.find((i) => normalizeSymbol(i.symbol) === normalizeSymbol(symbol));
  }, [allMarkets, intelligence, symbol]);

  const related = useMemo(() => {
    const items = enrichWithIntelligence(allMarkets ?? [], intelligence);
    return relatedPairs(items, symbol, 6);
  }, [allMarkets, intelligence, symbol]);

  const stats = useMemo(() => {
    if (!data) return null;
    const lastPrice = live?.lastPrice ?? Number(data.last_price ?? 0);
    const changePct = live?.changePct ?? Number(data.change_pct ?? 0);
    const ck = changeColorKey(changePct);
    return {
      lastPrice,
      changePct,
      direction: ck === 'buy' ? 'up' as const : ck === 'sell' ? 'down' as const : 'neutral' as const,
      high: Number(data.high_24h ?? 0),
      low: Number(data.low_24h ?? 0),
      volume: Number(data.volume_24h ?? 0),
      open: Number(data.open_24h ?? 0),
    };
  }, [data, live]);

  const sparkData =
    intelItem?.sparkline && intelItem.sparkline.length >= 2
      ? intelItem.sparkline
      : sparklineFromChange(stats?.changePct ?? 0, symbol.length);

  if (isLoading && !data) {
    return (
      <ScreenLayout testID="S-202">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (isError || !data || !stats) {
    return (
      <ScreenLayout testID="S-202">
        <EmptyState title="Market not found" onAction={() => void refetch()} actionLabel="Retry" />
      </ScreenLayout>
    );
  }

  const onRefresh = () => {
    void refetch();
    refetchPreview();
  };

  const goTrade = () => {
    requireAuth(() => {
      navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading', params: { symbol } });
    });
  };

  const goFullChart = () => {
    navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading', params: { symbol } });
  };

  return (
    <ScreenLayout testID="S-202">
      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {data.base_asset}
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>
                /{data.quote_asset}
              </Text>
            </Text>
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
              Spot · {symbol}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void hapticLight();
              toggle(symbol);
            }}
            accessibilityLabel="Toggle watchlist"
          >
            <Text style={{ fontSize: 22, color: `hsl(${theme.colors.brandPrimary})` }}>
              {isFavorite(symbol) ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>

        <TerminalPanel style={{ marginBottom: theme.spacing[4] }}>
          <PriceFlashText
            value={formatPrice(stats.lastPrice, data.quote_asset)}
            direction={stats.direction}
            size="xl"
          />
          <View style={styles.changeRow}>
            <ChangeLabel changePct={stats.changePct} />
            <Sparkline
              data={sparkData}
              color={`hsl(${stats.direction === 'up' ? theme.colors.tradeBuy : stats.direction === 'down' ? theme.colors.tradeSell : theme.colors.foregroundSecondary})`}
              width={80}
              height={28}
            />
          </View>
        </TerminalPanel>

        <View style={styles.statsGrid}>
          <StatCard label="24h High" value={formatPrice(stats.high, '')} theme={theme} />
          <StatCard label="24h Low" value={formatPrice(stats.low, '')} theme={theme} />
          <StatCard label="24h Open" value={formatPrice(stats.open, '')} theme={theme} />
          <StatCard label="24h Volume" value={formatVolume(stats.volume)} theme={theme} />
          {intelItem?.change7dPct != null ? (
            <StatCard label="7D Change" value={`${intelItem.change7dPct >= 0 ? '+' : ''}${intelItem.change7dPct.toFixed(2)}%`} theme={theme} />
          ) : null}
          {intelItem?.marketCap != null ? (
            <StatCard label="Market Cap" value={formatMarketCap(intelItem.marketCap)} theme={theme} />
          ) : null}
          {data.bid ? <StatCard label="Best Bid" value={formatPrice(Number(data.bid), '')} theme={theme} /> : null}
          {data.ask ? <StatCard label="Best Ask" value={formatPrice(Number(data.ask), '')} theme={theme} /> : null}
        </View>

        <View style={styles.chartHeader}>
          <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            OHLC Chart
          </Text>
          <Pressable onPress={goFullChart} accessibilityRole="button">
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700', fontSize: 13 }}>
              Open Full Chart →
            </Text>
          </Pressable>
        </View>
        <PillTabBar
          tabs={CHART_INTERVALS.map((i) => ({ id: String(i.sec), label: i.label }))}
          active={String(chartInterval)}
          onChange={(id) => setChartInterval(Number(id))}
        />
        {candlesLoading && !candles ? (
          <SkeletonList rows={3} />
        ) : (
          <TerminalPanel padded={false} style={{ marginBottom: theme.spacing[4] }}>
            <CandleChart candles={candles ?? []} height={200} />
          </TerminalPanel>
        )}

        <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }]}>
          Orderbook Preview
        </Text>
        {previewLoading && !orderbook ? (
          <SkeletonList rows={4} />
        ) : (
          <OrderbookPreview book={orderbook} maxRows={6} />
        )}

        <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 12, marginBottom: 8 }]}>
          Recent Trades
        </Text>
        <RecentTradesPreview trades={trades} maxRows={8} />

        <RelatedPairsSection
          pairs={related}
          onSelect={(sym) => navigation.replace('PairDetail', { symbol: sym })}
        />

        <CoinAboutSection coin={coinQ.data} isLoading={coinQ.isLoading} />

        {data.last_price_stale ? (
          <ErrorBanner message="Price may be stale" onRetry={() => void refetch()} />
        ) : null}

        <PrimaryButton title="Trade" size="xl" onPress={goTrade} />
        <PrimaryButton
          title={isFavorite(symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
          variant="outline"
          onPress={() => toggle(symbol)}
          style={{ marginTop: theme.spacing[3], marginBottom: theme.spacing[6] }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text
        style={[
          theme.typography.price,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.monoSemiBold, marginTop: 4 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  changeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { flexBasis: '47%', flexGrow: 1, padding: 12, borderWidth: 1, minHeight: 64 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
});
