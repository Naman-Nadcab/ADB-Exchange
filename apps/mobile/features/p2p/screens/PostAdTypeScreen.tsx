import { useEffect } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SegmentControl } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdType'>;

export function PostAdTypeScreen({ navigation }: Props) {
  const draft = useP2PStore((s) => s.postAdDraft);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);

  useEffect(() => {
    analytics.screen('S-603');
  }, []);

  return (
    <ScreenLayout testID="S-603">
      <SegmentControl
        tabs={[
          { id: 'sell', label: 'Sell crypto' },
          { id: 'buy', label: 'Buy crypto' },
        ]}
        active={draft.type ?? 'sell'}
        onChange={(id) => setDraft({ type: id as 'buy' | 'sell' })}
      />
      <View style={{ marginTop: 24 }}>
        <PrimaryButton title="Next: Price & Limits" onPress={() => navigation.navigate('PostAdPrice')} />
      </View>
    </ScreenLayout>
  );
}
