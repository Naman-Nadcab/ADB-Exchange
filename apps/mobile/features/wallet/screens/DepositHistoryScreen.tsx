import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar, SegmentControl, TxHistoryRow } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useDeposits } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';
import type { DepositRecord } from '@exchange/mobile-types';

type DepositPage = { items: DepositRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositHistory'>;

export function DepositHistoryScreen({ navigation }: Props) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDeposits(status || undefined);

  useEffect(() => {
    analytics.screen('S-513');
  }, []);

  const items = useMemo(() => {
    const all = q.data?.pages.flatMap((p: DepositPage) => p.items) ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter((d: DepositRecord) => d.symbol.toLowerCase().includes(s) || d.tx_hash?.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <ScreenLayout testID="S-513">
      <SegmentControl tabs={STATUS_TABS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search asset or tx" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.symbol} · ${item.chain_name ?? ''}`}
            value={`+${item.amount}`}
            sub={`${item.status} · ${item.confirmations ?? 0}/${item.required_confirmations ?? '?'} conf · ${new Date(item.created_at).toLocaleString()}`}
            direction="in"
            onPress={
              item.tx_hash
                ? () => navigation.navigate('DepositDetail', { txHash: item.tx_hash! })
                : undefined
            }
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No deposits" /> : null}
      />
    </ScreenLayout>
  );
}
