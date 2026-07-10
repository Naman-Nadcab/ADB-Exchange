import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, TxHistoryRow } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useFundHistory } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'FundHistory'>;

export function FundHistoryScreen(_props: Props) {
  const q = useFundHistory();

  useEffect(() => {
    analytics.screen('S-551');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-551">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.kind} · ${item.asset}`}
            value={item.amount}
            sub={`${item.displayStatus} · ${new Date(item.created_at).toLocaleString()}`}
            direction={item.kind === 'deposit' ? 'in' : 'out'}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No fund history" /> : null}
      />
    </ScreenLayout>
  );
}
