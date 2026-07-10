import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AntiPhishing'>;

export function AntiPhishingScreen(_props: Props) {
  const [code, setCode] = useState('');

  useEffect(() => {
    analytics.screen('S-715');
    void getAuthRepository().getAntiPhishingStatus().then((s) => setCode(s.code ?? ''));
  }, []);

  return (
    <ScreenLayout testID="S-715">
      <ScrollView>
        <TextField label="Anti-phishing code" value={code} onChangeText={setCode} />
        <PrimaryButton title="Save" onPress={() => void getAuthRepository().setAntiPhishing(code)} />
      </ScrollView>
    </ScreenLayout>
  );
}
