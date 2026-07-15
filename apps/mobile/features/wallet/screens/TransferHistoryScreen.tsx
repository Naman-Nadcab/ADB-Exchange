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
import { transferAccountLabel, transferStatusLabel } from '@core/domain/wallet/transfer';
import { useTransferHistory } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

const STATUS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'TransferHistory'>;

export function TransferHistoryScreen(_props: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useTransferHistory();

  useEffect(() => {
    analytics.screen('S-532');
  }, []);

  const items = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.items) ?? [];
    return all.filter((item) => {
      if (status && item.status.toLowerCase() !== status) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        item.symbol.toLowerCase().includes(s) ||
        item.fromAccount.toLowerCase().includes(s) ||
        item.toAccount.toLowerCase().includes(s) ||
        item.description.toLowerCase().includes(s)
      );
    });
  }, [q.data, status, search]);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  return (
    <ScreenLayout testID="S-532">
      {!isOnline ? <ErrorBanner message="Offline — history may be stale" onRetry={onRefresh} /> : null}
      <SegmentControl tabs={STATUS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin or account" />

      {q.isLoading && !q.data ? (
        <SkeletonList rows={8} />
      ) : q.isError ? (
        <ErrorState title="Could not load transfer history" onRetry={onRefresh} />
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
              label={`${item.symbol} · ${transferStatusLabel(item.status)}`}
              value={`${item.direction === 'sent' ? '-' : '+'}${item.amount}`}
              sub={`${transferAccountLabel(item.fromAccount)} → ${transferAccountLabel(item.toAccount)} · ${new Date(item.createdAt).toLocaleString()}`}
              direction={item.direction === 'received' ? 'in' : 'out'}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No transfers yet" message="Internal transfers between your accounts will appear here." />
          }
        />
      )}
    </ScreenLayout>
  );
}
