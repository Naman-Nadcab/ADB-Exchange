import { useEffect, useMemo } from 'react';
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
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { formatPrice, changeColorKey, formatVolume } from '@core/domain/markets/formatPrice';
import { useTicker } from '../hooks/useMarkets';
import { useTickerSubscription } from '../hooks/useTickerSubscription';
import { useRecentMarkets } from '../hooks/useRecentMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';
import { Sparkline, sparklineFromChange } from '../components/Sparkline';
import { usePairCandles } from '../hooks/usePairCandles';
import { CandleChart } from '@shared/ui';
import type { MarketsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'PairDetail'>;

export function PairDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const { theme } = useTheme();
  const { data, isLoading, isError, refetch, isFetching } = useTicker(symbol);
  const { addRecent } = useRecentMarkets();
  const { toggle, isFavorite } = useFavorites();
  const live = useMarketDataStore((s) => s.live[normalizeSymbol(symbol)]);
  const { data: candles, isLoading: candlesLoading } = usePairCandles(symbol, 3600);

  useTickerSubscription(symbol);

  useEffect(() => {
    analytics.screen('S-202');
    addRecent(symbol);
  }, [symbol, addRecent]);

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

  return (
    <ScreenLayout testID="S-202">
      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
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
            accessibilityLabel="Toggle favorite"
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
            accessibilityLabel={`Price ${formatPrice(stats.lastPrice, data.quote_asset)}`}
          />
          <View style={styles.changeRow}>
            <ChangeLabel changePct={stats.changePct} />
            <Sparkline
              data={sparklineFromChange(stats.changePct, symbol.length)}
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
          {data.bid ? <StatCard label="Best Bid" value={formatPrice(Number(data.bid), '')} theme={theme} /> : null}
          {data.ask ? <StatCard label="Best Ask" value={formatPrice(Number(data.ask), '')} theme={theme} /> : null}
        </View>

        <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }]}>
          24H Chart
        </Text>
        {candlesLoading && !candles ? (
          <SkeletonList rows={3} />
        ) : (
          <TerminalPanel padded={false} style={{ marginBottom: theme.spacing[4] }}>
            <CandleChart candles={candles ?? []} height={180} />
          </TerminalPanel>
        )}

        {data.last_price_stale ? (
          <ErrorBanner message="Price may be stale" onRetry={() => void refetch()} />
        ) : null}

        <PrimaryButton
          title="Trade"
          size="xl"
          onPress={() =>
            navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading', params: { symbol } })
          }
        />
        <PrimaryButton
          title={isFavorite(symbol) ? 'Remove from Favorites' : 'Add to Favorites'}
          variant="outline"
          onPress={() => toggle(symbol)}
          style={{ marginTop: theme.spacing[3] }}
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
});
