import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, EmptyState, TxHistoryRow } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useConvertHistory } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'ConvertHistory'>;

export function ConvertHistoryScreen(_props: Props) {
  const q = useConvertHistory();

  useEffect(() => {
    analytics.screen('S-543');
  }, []);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <ScreenLayout testID="S-543">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.from_symbol} → ${item.to_symbol}`}
            value={`${item.from_amount} → ${item.to_amount}`}
            sub={`${item.status} · ${new Date(item.created_at).toLocaleString()}`}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No conversions yet" /> : null}
      />
    </ScreenLayout>
  );
}
