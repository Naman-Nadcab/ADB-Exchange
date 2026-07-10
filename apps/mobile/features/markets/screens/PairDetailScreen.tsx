import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SkeletonList, EmptyState, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { formatPrice, formatChangePct, changeColorKey, formatVolume } from '@core/domain/markets/formatPrice';
import { useTicker } from '../hooks/useMarkets';
import { useTickerSubscription } from '../hooks/useTickerSubscription';
import { useRecentMarkets } from '../hooks/useRecentMarkets';
import { useFavorites } from '../hooks/useFavorites';
import { useMarketDataStore } from '@core/state/marketDataStore';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';
import type { MarketsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MarketsStackParamList, 'PairDetail'>;

export function PairDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const { theme } = useTheme();
  const { data, isLoading, isError, refetch } = useTicker(symbol);
  const { addRecent } = useRecentMarkets();
  const { toggle, isFavorite } = useFavorites();
  const live = useMarketDataStore((s) => s.live[normalizeSymbol(symbol)]);

  useTickerSubscription(symbol);

  useEffect(() => {
    analytics.screen('S-202');
    addRecent(symbol);
  }, [symbol, addRecent]);

  if (isLoading && !data) return <ScreenLayout testID="S-202"><SkeletonList rows={4} /></ScreenLayout>;
  if (isError || !data) {
    return (
      <ScreenLayout testID="S-202">
        <EmptyState title="Market not found" onAction={() => void refetch()} actionLabel="Retry" />
      </ScreenLayout>
    );
  }

  const lastPrice = live?.lastPrice ?? Number(data.last_price ?? 0);
  const changePct = live?.changePct ?? Number(data.change_pct ?? 0);
  const ck = changeColorKey(changePct);
  const changeColor =
    ck === 'buy' ? theme.colors.tradeBuy : ck === 'sell' ? theme.colors.tradeSell : theme.colors.foregroundSecondary;

  return (
    <ScreenLayout testID="S-202">
      <ScrollView>
        <Text style={[styles.pair, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {data.base_asset}/{data.quote_asset}
        </Text>
        <Text
          style={[styles.price, { color: `hsl(${theme.colors.foregroundPrimary})` }]}
          accessibilityRole="text"
          accessibilityLabel={`Price ${formatPrice(lastPrice, data.quote_asset)}`}
        >
          {formatPrice(lastPrice, data.quote_asset)}
        </Text>
        <Text style={[styles.change, { color: `hsl(${changeColor})` }]}>{formatChangePct(changePct)}</Text>
        <View style={styles.stats}>
          <Stat label="24h High" value={formatPrice(Number(data.high_24h ?? 0), '')} theme={theme} />
          <Stat label="24h Low" value={formatPrice(Number(data.low_24h ?? 0), '')} theme={theme} />
          <Stat label="24h Volume" value={formatVolume(Number(data.volume_24h ?? 0))} theme={theme} />
          {data.bid ? <Stat label="Bid" value={formatPrice(Number(data.bid), '')} theme={theme} /> : null}
          {data.ask ? <Stat label="Ask" value={formatPrice(Number(data.ask), '')} theme={theme} /> : null}
        </View>
        {data.last_price_stale ? (
          <ErrorBanner message="Price may be stale" onRetry={() => void refetch()} />
        ) : null}
        <PrimaryButton
          title={isFavorite(symbol) ? 'Remove Favorite' : 'Add Favorite'}
          variant="secondary"
          onPress={() => toggle(symbol)}
        />
        <PrimaryButton
          title="Trade"
          onPress={() => navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading', params: { symbol } })}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

function Stat({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.stat}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  price: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 16, fontWeight: '600', marginVertical: 12 },
  stats: { gap: 12, marginVertical: 16 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 },
});
