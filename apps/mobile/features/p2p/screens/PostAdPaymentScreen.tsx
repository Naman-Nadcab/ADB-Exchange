import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useMyPaymentMethods } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdPayment'>;

export function PostAdPaymentScreen({ navigation }: Props) {
  const setDraft = useP2PStore((s) => s.setPostAdDraft);
  const draft = useP2PStore((s) => s.postAdDraft);
  const [selected, setSelected] = useState<string[]>(draft.payment_method_ids ?? []);
  const pmQ = useMyPaymentMethods();

  useEffect(() => {
    analytics.screen('S-605');
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <ScreenLayout testID="S-605">
      <FlatList
        data={pmQ.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggle(item.id)} style={{ paddingVertical: 12 }}>
            <Text>
              {selected.includes(item.id) ? '☑' : '☐'} {item.display_name ?? item.method_name}
            </Text>
          </Pressable>
        )}
      />
      <PrimaryButton
        title="Review"
        onPress={() => {
          setDraft({ payment_method_ids: selected });
          navigation.navigate('PostAdReview');
        }}
      />
    </ScreenLayout>
  );
}
