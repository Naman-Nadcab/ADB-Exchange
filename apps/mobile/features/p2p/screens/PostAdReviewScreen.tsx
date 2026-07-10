import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useCreateAd } from '../hooks/useP2P';
import { ApiError } from '@core/api/errors/ApiError';
import type { P2PStackParamList } from '../navigation/types';
import type { CreateP2PAdRequest } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdReview'>;

export function PostAdReviewScreen({ navigation }: Props) {
  const draft = useP2PStore((s) => s.postAdDraft);
  const clearDraft = useP2PStore((s) => s.clearPostAdDraft);
  const create = useCreateAd();

  useEffect(() => {
    analytics.screen('S-606');
  }, []);

  const publish = async () => {
    const body = draft as CreateP2PAdRequest;
    try {
      await create.mutateAsync(body);
      clearDraft();
      navigation.navigate('MyAds');
    } catch {
      /* ErrorBanner via create.isError */
    }
  };

  return (
    <ScreenLayout testID="S-606">
      <ScrollView>
        <Text>Type: {draft.type}</Text>
        <Text>Pair: {draft.currency}/{draft.fiat}</Text>
        <Text>Price: {draft.price}</Text>
        <Text>Limits: {draft.min_amount} – {draft.max_amount}</Text>
        <Text>Available: {draft.available_amount}</Text>
        <Text>Methods: {(draft.payment_method_ids ?? []).join(', ')}</Text>
        {create.isError ? <ErrorBanner message={create.error instanceof ApiError ? create.error.message : 'Failed'} /> : null}
        <PrimaryButton title="Publish Ad" loading={create.isPending} onPress={() => void publish()} />
      </ScrollView>
    </ScreenLayout>
  );
}
