import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar, SegmentControl, TxHistoryRow } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useWithdrawals } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

const STATUS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Done' },
  { id: 'pending', label: 'Pending' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawalHistory'>;

export function WithdrawalHistoryScreen({ navigation }: Props) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useWithdrawals(search || undefined, status || undefined);

  useEffect(() => {
    analytics.screen('S-526');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-526">
      <SegmentControl tabs={STATUS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Filter by coin" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.asset ?? item.symbol} · ${item.displayStatus ?? item.status}`}
            value={`-${item.quantity ?? item.amount}`}
            sub={new Date(item.date_time ?? item.createdAt ?? Date.now()).toLocaleString()}
            direction="out"
            onPress={() => navigation.navigate('WithdrawalDetail', { withdrawalId: item.id })}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No withdrawals" /> : null}
      />
    </ScreenLayout>
  );
}
