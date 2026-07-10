import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useWithdrawalAddresses, useUpdateAddress } from '../hooks/useBlockchainWallet';
import { ApiError } from '@core/api/errors/ApiError';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'EditAddress'>;

export function EditAddressScreen({ navigation, route }: Props) {
  const q = useWithdrawalAddresses();
  const item = q.data?.find((a) => a.id === route.params.id);
  const [note, setNote] = useState(item?.note ?? '');
  const [memo, setMemo] = useState(item?.memo ?? '');
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateAddress();

  useEffect(() => {
    analytics.screen('S-719');
  }, []);

  useEffect(() => {
    if (item) {
      setNote(item.note ?? '');
      setMemo(item.memo ?? '');
    }
  }, [item]);

  const submit = async () => {
    if (!item) return;
    setError(null);
    try {
      await update.mutateAsync({ id: item.id, note, memo });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  if (!item) {
    return (
      <ScreenLayout>
        <ErrorBanner message="Address not found" />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView>
        <Text style={{ marginBottom: 8, fontWeight: '600' }}>Asset: {item.asset}</Text>
        <Text style={{ marginBottom: 16, fontFamily: 'monospace', fontSize: 12 }}>{item.address}</Text>
        <TextField label="Nickname" value={note} onChangeText={setNote} />
        <TextField label="Memo" value={memo} onChangeText={setMemo} />
        {item.is_whitelisted ? (
          <ErrorBanner message="Whitelisted address" />
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Save" loading={update.isPending} onPress={() => void submit()} />
      </ScrollView>
    </ScreenLayout>
  );
}
