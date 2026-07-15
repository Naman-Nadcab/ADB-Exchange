import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, StyleSheet, View, RefreshControl, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenLayout, PrimaryButton, ErrorBanner, ErrorState, SkeletonList, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import {
  bankLabelFromSnapshot,
  canCancelFiatWithdrawal,
  fiatWithdrawalStatusTone,
  fiatWithdrawalTimestamp,
  formatInr,
  mapFiatWithdrawApiError,
  resolveFiatWithdrawal,
  FIAT_WITHDRAWALS_QUERY_KEY,
} from '@core/domain/wallet/fiat';
import { useCancelFiatWithdrawal, useFiatWithdrawals } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'FiatWithdrawalDetail'>;

export function FiatWithdrawalDetailScreen({ route }: Props) {
  const { withdrawalId, snapshot } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const qc = useQueryClient();
  const listQ = useFiatWithdrawals();
  const cancel = useCancelFiatWithdrawal();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    analytics.screen('S-528');
  }, []);

  useEffect(() => {
    void qc.invalidateQueries({ queryKey: FIAT_WITHDRAWALS_QUERY_KEY });
  }, [withdrawalId, qc]);

  const item = useMemo(() => {
    const fromList = listQ.data?.find((w) => w.id === withdrawalId);
    if (fromList) return fromList;
    return resolveFiatWithdrawal(qc, withdrawalId, snapshot);
  }, [listQ.data, qc, withdrawalId, snapshot]);

  useEffect(() => {
    if (!item && listQ.isFetched && !listQ.isFetching) setExhausted(true);
  }, [item, listQ.isFetched, listQ.isFetching]);

  const onRefresh = useCallback(() => void listQ.refetch(), [listQ]);

  const confirmCancel = () => {
    Alert.alert('Cancel withdrawal?', 'Funds will be returned to your INR balance.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel withdrawal',
        style: 'destructive',
        onPress: () => {
          setCancelError(null);
          cancel.mutate(withdrawalId, {
            onError: (err) => {
              setCancelError(
                err instanceof ApiError ? mapFiatWithdrawApiError(err.code, err.message) : 'Could not cancel',
              );
            },
          });
        },
      },
    ]);
  };

  if (listQ.isLoading && !item) {
    return (
      <ScreenLayout testID="S-528">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (!item && exhausted) {
    return (
      <ScreenLayout testID="S-528">
        {!isOnline ? <ErrorBanner message="Offline — cannot refresh" onRetry={onRefresh} /> : null}
        <ErrorState title="Withdrawal not found" message="Pull to refresh or return to fiat withdrawals." onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-528">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  const tone = fiatWithdrawalStatusTone(item.status);

  return (
    <ScreenLayout testID="S-528">
      <ScrollView refreshControl={<RefreshControl refreshing={listQ.isFetching} onRefresh={onRefresh} />}>
        {!isOnline ? <ErrorBanner message="Offline — showing cached details" onRetry={onRefresh} /> : null}
        {listQ.isError ? (
          <ErrorBanner message="Could not refresh withdrawal" onRetry={onRefresh} />
        ) : null}

        <ExchangeCard elevated>
          <View style={styles.header}>
            <Text style={[styles.amount, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{formatInr(item.amount)}</Text>
            <StatusChip label={item.status} tone={tone} />
          </View>
          <DetailRow label="Fee" value={formatInr(item.fee)} />
          <DetailRow label="You receive" value={formatInr(item.net_amount)} highlight />
          <DetailRow label="Destination" value={bankLabelFromSnapshot(item.bank_snapshot)} />
          <DetailRow
            label="Method"
            value={String(item.bank_snapshot?.method_name ?? '—')}
          />
          <DetailRow label="Requested" value={fiatWithdrawalTimestamp(item)} />
          {item.reviewed_at ? <DetailRow label="Reviewed" value={new Date(item.reviewed_at).toLocaleString('en-IN')} /> : null}
          {item.completed_at ? <DetailRow label="Completed" value={new Date(item.completed_at).toLocaleString('en-IN')} /> : null}
          {item.failure_reason ? (
            <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginTop: 8 }}>
              Reason: {item.failure_reason}
            </Text>
          ) : null}
          {item.provider_reference ? (
            <DetailRow label="Reference" value={item.provider_reference} mono />
          ) : null}
        </ExchangeCard>

        {cancelError ? <ErrorBanner message={cancelError} onRetry={confirmCancel} /> : null}
        {canCancelFiatWithdrawal(item.status) ? (
          <PrimaryButton
            title="Cancel withdrawal"
            variant="outline"
            loading={cancel.isPending}
            onPress={confirmCancel}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary})`,
          fontWeight: highlight ? '700' : '600',
          flex: 1,
          textAlign: 'right',
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 11 : 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  amount: { fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
});
