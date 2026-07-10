import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { usePlatformPaymentMethods, useMyPaymentMethods, usePaymentMethodMutations } from '../hooks/useP2P';
import { ApiError } from '@core/api/errors/ApiError';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'AddPaymentMethod'>;

export function AddPaymentMethodScreen({ navigation, route }: Props) {
  const editId = route.params.id;
  const platformQ = usePlatformPaymentMethods();
  const myQ = useMyPaymentMethods();
  const { add, update } = usePaymentMethodMutations();
  const existing = myQ.data?.find((m) => m.id === editId);
  const [platformId, setPlatformId] = useState(existing?.payment_method_id ?? '');
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-612');
  }, []);

  const submit = async () => {
    setError(null);
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, display_name: displayName });
      } else {
        if (!platformId) {
          setError('Select platform method ID');
          return;
        }
        await add.mutateAsync({ payment_method_id: platformId, display_name: displayName });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    }
  };

  return (
    <ScreenLayout testID="S-612">
      <ScrollView>
        {!editId ? (
          <TextField
            label="Platform method ID"
            value={platformId}
            onChangeText={setPlatformId}
            placeholder={platformQ.data?.[0]?.id}
          />
        ) : null}
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Save" loading={add.isPending || update.isPending} onPress={() => void submit()} />
      </ScrollView>
    </ScreenLayout>
  );
}
