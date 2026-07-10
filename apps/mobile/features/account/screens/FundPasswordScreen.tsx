import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'FundPassword'>;

export function FundPasswordScreen(_props: Props) {
  const [pw, setPw] = useState('');
  const [set, setIsSet] = useState(false);

  useEffect(() => {
    analytics.screen('S-714');
    void getAuthRepository().getFundPasswordStatus().then((s) => setIsSet(!!s.isSet));
  }, []);

  return (
    <ScreenLayout testID="S-714">
      <ScrollView>
        <TextField label="Fund password" value={pw} onChangeText={setPw} secureTextEntry />
        <PrimaryButton title={set ? 'Update' : 'Set'} onPress={() => void getAuthRepository().setFundPassword(pw)} />
      </ScrollView>
    </ScreenLayout>
  );
}
