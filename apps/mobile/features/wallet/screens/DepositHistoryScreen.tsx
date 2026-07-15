import { useEffect, useMemo, useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, SearchBar, SegmentControl, TxHistoryRow, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { depositStatusLabel } from '@core/domain/wallet/deposit';
import { formatTxDate } from '@core/domain/wallet/transactions';
import { useDepositHistory } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositHistory'>;

export function DepositHistoryScreen({ navigation }: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDepositHistory(status || undefined);

  useEffect(() => {
    analytics.screen('S-513');
  }, []);

  const items = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.items) ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter(
      (d) =>
        d.symbol.toLowerCase().includes(s) ||
        d.txHash?.toLowerCase().includes(s) ||
        d.chainName?.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  return (
    <ScreenLayout testID="S-513">
      {!isOnline ? <ErrorBanner message="Offline — deposit history may be stale" onRetry={onRefresh} /> : null}
      <SegmentControl tabs={STATUS_TABS} active={status} onChange={setStatus} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search asset, network, or tx" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.symbol} · ${item.chainName ?? ''}`}
            value={`+${item.amount}`}
            sub={`${depositStatusLabel(item.status, item.confirmations, item.requiredConfirmations)} · ${formatTxDate(item.createdAt)}`}
            direction="in"
            onPress={
              item.txHash
                ? () => navigation.navigate('DepositDetail', { txHash: item.txHash! })
                : undefined
            }
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No deposits" message="On-chain deposits will appear here after you send to your deposit address." /> : null}
      />
    </ScreenLayout>
  );
}
