import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { validateCryptoAddress } from '@core/domain/wallet/withdraw';
import { useCreateAddress } from '../hooks/useBlockchainWallet';
import { ApiError } from '@core/api/errors/ApiError';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AddAddress'>;

export function AddAddressScreen({ navigation }: Props) {
  const [asset, setAsset] = useState('BTC');
  const [network, setNetwork] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateAddress();

  useEffect(() => {
    analytics.screen('S-720');
  }, []);

  const submit = async () => {
    setError(null);
    const addrErr = validateCryptoAddress(address);
    if (addrErr) {
      setError(addrErr);
      return;
    }
    try {
      await create.mutateAsync({ asset, network: network || undefined, address, note: note || undefined, memo: memo || undefined });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add address');
    }
  };

  return (
    <ScreenLayout testID="S-720">
      <ScrollView>
        <TextField label="Asset" value={asset} onChangeText={setAsset} />
        <TextField label="Network" value={network} onChangeText={setNetwork} />
        <TextField label="Nickname" value={note} onChangeText={setNote} />
        <TextField label="Address" value={address} onChangeText={setAddress} />
        <TextField label="Memo / Tag" value={memo} onChangeText={setMemo} />
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Save Address" loading={create.isPending} onPress={() => void submit()} />
      </ScrollView>
    </ScreenLayout>
  );
}
