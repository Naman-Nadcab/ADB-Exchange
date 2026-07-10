import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useTransferHistory } from '../hooks/useWallet';
import { TxHistoryRow } from '@shared/ui';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'TransferHistory'>;

export function TransferHistoryScreen(_props: Props) {
  const q = useTransferHistory();

  useEffect(() => {
    analytics.screen('S-532');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-532">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.symbol} · ${item.description}`}
            value={`${item.direction === 'sent' ? '-' : '+'}${item.amount}`}
            sub={new Date(item.createdAt).toLocaleString()}
            direction={item.direction === 'received' ? 'in' : 'out'}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No transfers yet" /> : null}
      />
    </ScreenLayout>
  );
}
