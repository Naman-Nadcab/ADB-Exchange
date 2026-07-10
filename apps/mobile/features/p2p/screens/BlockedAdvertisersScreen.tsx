import { useEffect } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useUnblockAdvertiser } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'BlockedAdvertisers'>;

export function BlockedAdvertisersScreen(_props: Props) {
  const blocked = useP2PStore((s) => s.blockedAdvertiserIds);
  const unblock = useUnblockAdvertiser();

  useEffect(() => {
    analytics.screen('S-616');
  }, []);

  return (
    <ScreenLayout testID="S-616">
      <FlatList
        data={blocked}
        keyExtractor={(id) => id}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 12 }} onPress={() => unblock.mutate(item)}>
            <Text>{item}</Text>
            <Text style={{ fontSize: 12 }}>Tap to unblock</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No blocked advertisers</Text>}
      />
    </ScreenLayout>
  );
}
