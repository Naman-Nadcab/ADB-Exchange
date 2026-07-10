import { useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, TxHistoryRow, EmptyState } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { displayOrderStatus } from '@core/domain/p2p/order';
import { useMyP2POrders, useP2PSubscriptions } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

const TABS = [
  { id: '', label: 'All' },
  { id: 'payment_pending', label: 'Pending' },
  { id: 'payment_sent', label: 'Paid' },
  { id: 'released', label: 'Done' },
];

type Props = NativeStackScreenProps<P2PStackParamList, 'OrdersList'>;

export function OrdersListScreen({ navigation }: Props) {
  const [status, setStatus] = useState('');
  const q = useMyP2POrders(status || undefined);
  useP2PSubscriptions();

  useEffect(() => {
    analytics.screen('S-609');
  }, []);

  return (
    <ScreenLayout testID="S-609">
      <SegmentControl tabs={TABS} active={status} onChange={setStatus} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        renderItem={({ item }) => (
          <TxHistoryRow
            label={`${item.crypto_symbol ?? ''} · ${displayOrderStatus(item.status)}`}
            value={item.quantity}
            sub={item.created_at ? new Date(item.created_at).toLocaleString() : ''}
            direction="out"
            onPress={() => navigation.navigate('OrderRoom', { orderId: item.id })}
          />
        )}
        ListEmptyComponent={!q.isLoading ? <EmptyState title="No P2P orders" /> : null}
      />
    </ScreenLayout>
  );
}
