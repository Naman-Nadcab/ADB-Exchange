import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar, SegmentControl, TxHistoryRow, ErrorBanner, ErrorState, SkeletonList } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { withdrawalStatusLabel } from '@core/domain/wallet/withdraw';
import { useWithdrawals } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

const STATUS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawalHistory'>;

export function WithdrawalHistoryScreen({ navigation }: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useWithdrawals(search.trim() || undefined, status || undefined);

  useEffect(() => {
    analytics.screen('S-526');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const onRefresh = useCallback(() => void q.refetch(), [q]);

  return (
    <ScreenLayout testID="S-526">
      {!isOnline ? <ErrorBanner message="Offline — history may be stale" onRetry={onRefresh} /> : null}
      <SegmentControl tabs={STATUS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Filter by coin" />

      {q.isLoading && !q.data ? (
        <SkeletonList rows={8} />
      ) : q.isError ? (
        <ErrorState title="Could not load withdrawals" onRetry={onRefresh} />
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
              label={`${item.asset ?? item.symbol} · ${withdrawalStatusLabel(item.displayStatus ?? item.status)}`}
              value={`-${item.quantity ?? item.amount}`}
              sub={`${item.chain_name ?? item.chain ?? ''} · ${new Date(item.date_time ?? item.createdAt ?? Date.now()).toLocaleString()}`}
              direction="out"
              onPress={() => navigation.navigate('WithdrawalDetail', { withdrawalId: item.id, snapshot: item })}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No withdrawals" message="Your withdrawal history will appear here." />
          }
        />
      )}
    </ScreenLayout>
  );
}
