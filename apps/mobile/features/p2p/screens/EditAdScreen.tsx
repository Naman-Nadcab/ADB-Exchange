import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useMyP2PAds, useUpdateAd } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'EditAd'>;

export function EditAdScreen({ navigation, route }: Props) {
  const q = useMyP2PAds();
  const update = useUpdateAd();
  const ad = useMemo(() => q.data?.find((a) => a.id === route.params.adId), [q.data, route.params.adId]);
  const [price, setPrice] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    analytics.screen('S-608');
  }, []);

  useEffect(() => {
    if (ad) {
      setPrice(ad.current_price ?? ad.price ?? '');
      setRemarks(ad.remarks ?? ad.terms_and_conditions ?? '');
    }
  }, [ad]);

  if (!ad) return <ScreenLayout><PrimaryButton title="Back" onPress={() => navigation.goBack()} /></ScreenLayout>;

  return (
    <ScreenLayout testID="S-608">
      <ScrollView>
        <TextField label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <TextField label="Remarks / Auto reply" value={remarks} onChangeText={setRemarks} />
        <PrimaryButton
          title="Save"
          loading={update.isPending}
          onPress={() => {
            void update.mutateAsync({ id: ad.id, price, remarks, auto_reply: remarks });
            navigation.goBack();
          }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}
