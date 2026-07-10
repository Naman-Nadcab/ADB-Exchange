import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, TxHistoryRow, SegmentControl } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useLedger } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

const TYPES = [
  { id: '', label: 'All' },
  { id: 'convert', label: 'Convert' },
  { id: 'spot_trade', label: 'Trade' },
  { id: 'internal_transfer', label: 'Transfer' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'TransactionHistory'>;

export function TransactionHistoryScreen(_props: Props) {
  const [type, setType] = useState('');
  const q = useLedger(type ? { type } : undefined);

  useEffect(() => {
    analytics.screen('S-550');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-550">
      <SegmentControl tabs={TYPES} active={type} onChange={setType} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.type} · ${item.asset}`}
            value={`${item.direction === 'in' ? '+' : '-'}${item.amount}`}
            sub={`${item.displayStatus} · ${new Date(item.created_at).toLocaleString()}`}
            direction={item.direction}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No transactions" /> : null}
      />
    </ScreenLayout>
  );
}
