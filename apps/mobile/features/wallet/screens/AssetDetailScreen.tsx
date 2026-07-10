import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { mergeAssets, computeAllocation, formatUsd } from '@core/domain/wallet/portfolio';
import { useFundingBalances, useTradingBalances, usePortfolioHistory, useCoinInfo } from '../hooks/useWallet';
import { AllocationChart } from '../components/AllocationChart';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AssetDetail'>;

export function AssetDetailScreen({ route }: Props) {
  const { symbol } = route.params;
  const { theme } = useTheme();
  const fundingQ = useFundingBalances();
  const tradingQ = useTradingBalances();
  const historyQ = usePortfolioHistory('7d');
  const coinQ = useCoinInfo(symbol);

  useEffect(() => {
    analytics.screen('S-501');
  }, []);

  const asset = useMemo(() => {
    const merged = mergeAssets(fundingQ.data?.balances, tradingQ.data?.balances);
    return merged.find((a) => a.symbol === symbol);
  }, [fundingQ.data, tradingQ.data, symbol]);

  const allocation = useMemo(() => {
    const merged = mergeAssets(fundingQ.data?.balances, tradingQ.data?.balances);
    return computeAllocation(merged).find((s) => s.symbol === symbol);
  }, [fundingQ.data, tradingQ.data, symbol]);

  if (!asset && (fundingQ.isLoading || tradingQ.isLoading)) {
    return (
      <ScreenLayout testID="S-501">
        <SkeletonList rows={5} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-501">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {asset?.name ?? symbol}
        </Text>
        <Text style={[styles.value, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          ${formatUsd(asset?.usdValue ?? '0')}
        </Text>
        {allocation ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>
            Portfolio allocation: {allocation.pct.toFixed(1)}%
          </Text>
        ) : null}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Holdings</Text>
          <DetailRow label="Funding total" value={`${asset?.fundingTotal ?? '0'} ${symbol}`} />
          <DetailRow label="Funding available" value={`${asset?.fundingAvailable ?? '0'} ${symbol}`} />
          <DetailRow label="Funding locked" value={`${asset?.fundingLocked ?? '0'} ${symbol}`} />
          <DetailRow label="Trading equity" value={`${asset?.tradingEquity ?? '0'} ${symbol}`} />
        </View>
        {coinQ.data ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Coin Overview
            </Text>
            {coinQ.data.current_price != null ? (
              <DetailRow label="Market price" value={`$${formatUsd(coinQ.data.current_price)}`} />
            ) : null}
            {coinQ.data.price_change_percentage_24h != null ? (
              <DetailRow label="24h change" value={`${coinQ.data.price_change_percentage_24h.toFixed(2)}%`} />
            ) : null}
          </View>
        ) : null}
        {historyQ.data?.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Portfolio trend (7d)
            </Text>
            <AllocationChart slices={[{ symbol: 'Portfolio', usdValue: historyQ.data[historyQ.data.length - 1].total_usd, pct: 100 }]} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700' },
  value: { fontSize: 28, fontWeight: '700', marginVertical: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
