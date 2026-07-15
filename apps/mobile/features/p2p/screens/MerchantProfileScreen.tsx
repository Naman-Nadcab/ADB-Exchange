import { useEffect } from 'react';
import { FlatList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useP2PAds, useBlockAdvertiser } from '../hooks/useP2P';
import { P2PAdCard } from '../components/P2PAdCard';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MerchantProfile'>;

export function MerchantProfileScreen({ route, navigation }: Props) {
  const { advertiserId } = route.params;
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const q = useP2PAds({ advertiser_id: advertiserId });
  const block = useBlockAdvertiser();

  useEffect(() => {
    analytics.screen('S-614');
  }, []);

  const ads = q.data?.pages.flat() ?? [];

  return (
    <ScreenLayout testID="S-614">
      <PrimaryButton title="Block advertiser" variant="secondary" onPress={() => block.mutate(advertiserId)} />
      <FlatList
        data={ads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <P2PAdCard
            ad={item}
            fiat={item.fiat_currency}
            authed={isAuthenticated}
            onPress={() => navigation.navigate('AdDetail', { adId: item.id, ad: item })}
            onTrade={() => navigation.navigate('AdDetail', { adId: item.id, ad: item })}
          />
        )}
      />
    </ScreenLayout>
  );
}
