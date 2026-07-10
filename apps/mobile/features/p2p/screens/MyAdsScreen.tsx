import { useEffect } from 'react';
import { FlatList, Pressable, Text, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAdPrice } from '@core/domain/p2p/order';
import { useMyP2PAds, useUpdateAd, useDeleteAd } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MyAds'>;

export function MyAdsScreen({ navigation }: Props) {
  const q = useMyP2PAds();
  const update = useUpdateAd();
  const del = useDeleteAd();

  useEffect(() => {
    analytics.screen('S-607');
  }, []);

  return (
    <ScreenLayout testID="S-607">
      <PrimaryButton title="Post new ad" onPress={() => navigation.navigate('PostAdType')} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={{ paddingVertical: 12 }}
            onPress={() => navigation.navigate('EditAd', { adId: item.id })}
            onLongPress={() =>
              Alert.alert('Delete ad?', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => del.mutate(item.id) },
              ])
            }
          >
            <Text style={{ fontWeight: '700' }}>
              {item.crypto_symbol} · {getAdPrice(item)} · {item.status ?? 'active'}
            </Text>
            <Text style={{ fontSize: 12 }}>Avail {item.available_amount}</Text>
            <Pressable onPress={() => update.mutate({ id: item.id, status: item.status === 'paused' ? 'active' : 'paused' })}>
              <Text>{item.status === 'paused' ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
