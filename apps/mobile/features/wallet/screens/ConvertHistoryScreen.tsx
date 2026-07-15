import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenLayout,
  EmptyState,
  SearchBar,
  SegmentControl,
  TxHistoryRow,
  ErrorBanner,
  ErrorState,
  SkeletonList,
} from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { convertStatusLabel, formatRateDisplay } from '@core/domain/wallet/convert';
import { transferAccountLabel } from '@core/domain/wallet/transfer';
import { useConvertHistory } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

const STATUS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'ConvertHistory'>;

export function ConvertHistoryScreen(_props: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useConvertHistory(status || undefined);

  useEffect(() => {
    analytics.screen('S-543');
  }, []);

  const items = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.items) ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter(
      (item) =>
        item.from_symbol.toLowerCase().includes(s) ||
        item.to_symbol.toLowerCase().includes(s) ||
        item.conversion_type.toLowerCase().includes(s) ||
        item.account_type.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  return (
    <ScreenLayout testID="S-543">
      {!isOnline ? <ErrorBanner message="Offline — history may be stale" onRetry={onRefresh} /> : null}
      <SegmentControl tabs={STATUS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search asset or account" />

      {q.isLoading && !q.data ? (
        <SkeletonList rows={8} />
      ) : q.isError ? (
        <ErrorState title="Could not load conversion history" onRetry={onRefresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <TxHistoryRow
              label={`${item.from_symbol} → ${item.to_symbol} · ${convertStatusLabel(item.status)}`}
              value={`${item.from_amount} → ${item.to_amount}`}
              sub={`${formatRateDisplay(item.from_symbol, item.to_symbol, item.conversion_rate)} · ${transferAccountLabel(item.account_type)} · ${new Date(item.created_at).toLocaleString()}`}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No conversions yet" message="Your conversion history will appear here." />
          }
        />
      )}
    </ScreenLayout>
  );
}
