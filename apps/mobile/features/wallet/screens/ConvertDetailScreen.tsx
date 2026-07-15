import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, StyleSheet, View, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ErrorBanner, ErrorState, SkeletonList, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { clipboardPolicy } from '@core/security/clipboardPolicy';
import { convertStatusLabel, formatRateDisplay } from '@core/domain/wallet/convert';
import { transferAccountLabel } from '@core/domain/wallet/transfer';
import { buildWalletHistoryTimeline } from '@core/domain/wallet/walletHistory';
import { useConvertHistory } from '../hooks/useWallet';
import { WalletHistoryTimeline } from '../components/WalletHistoryTimeline';
import { WalletHistoryStatusChip } from '../components/WalletHistoryStatusChip';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'ConvertDetail'>;

function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

export function ConvertDetailScreen({ route }: Props) {
  const { conversionId } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useConvertHistory();

  useEffect(() => {
    analytics.screen('S-544');
  }, []);

  const item = useMemo(
    () => q.data?.pages.flatMap((p) => p.items).find((c) => c.id === conversionId),
    [q.data, conversionId],
  );

  useEffect(() => {
    if (item || q.isLoading) return;
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, [item, q.isLoading, q.hasNextPage, q.isFetchingNextPage, q]);

  const pendingLookup = !item && (q.isLoading || q.isFetchingNextPage || !!q.hasNextPage);
  const onRefresh = useCallback(() => void q.refetch(), [q]);

  if (pendingLookup) {
    return (
      <ScreenLayout testID="S-544">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-544">
        {!isOnline ? <ErrorBanner message="Offline — cannot refresh" onRetry={onRefresh} /> : null}
        <ErrorState title="Conversion not found" onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  const timeline = buildWalletHistoryTimeline(item.status, 'convert');
  const shareText = `Convert ${item.from_symbol} → ${item.to_symbol}\n${item.from_amount} → ${item.to_amount}\nRate: ${formatRateDisplay(item.from_symbol, item.to_symbol, item.conversion_rate)}\nStatus: ${convertStatusLabel(item.status)}`;

  return (
    <ScreenLayout testID="S-544">
      <ScrollView>
        {!isOnline ? <ErrorBanner message="Offline — status may be stale" onRetry={onRefresh} /> : null}

        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Conversion</Text>
        <WalletHistoryStatusChip label={convertStatusLabel(item.status)} status={item.status} />

        <DetailRow label="From" value={`${item.from_amount} ${item.from_symbol}`} theme={theme} />
        <DetailRow label="To" value={`${item.to_amount} ${item.to_symbol}`} theme={theme} />
        <DetailRow
          label="Rate"
          value={formatRateDisplay(item.from_symbol, item.to_symbol, item.conversion_rate)}
          theme={theme}
        />
        {item.fee_amount ? <DetailRow label="Fee" value={item.fee_amount} theme={theme} /> : null}
        <DetailRow label="Account" value={transferAccountLabel(item.account_type)} theme={theme} />
        <DetailRow label="Type" value={item.conversion_type} theme={theme} />
        <DetailRow label="Created" value={new Date(item.created_at).toLocaleString()} theme={theme} />
        {item.completed_at ? (
          <DetailRow label="Completed" value={new Date(item.completed_at).toLocaleString()} theme={theme} />
        ) : null}

        <WalletHistoryTimeline steps={timeline} />

        <View style={styles.actions}>
          <PrimaryButton title="Copy details" variant="secondary" onPress={() => void clipboardPolicy.copyWithExpiry(shareText)} />
          <PrimaryButton title="Share" variant="secondary" onPress={() => void Share.share({ message: shareText })} />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
