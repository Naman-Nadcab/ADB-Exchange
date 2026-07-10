import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'TwoFA'>;

export function TwoFAScreen(_props: Props) {
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-712');
    void getAuthRepository().get2FAStatus().then((s) => setEnabled(s.enabled));
  }, []);

  const setup = async () => {
    const res = await getAuthRepository().setup2FA();
    setSecret(res.secret ?? '');
  };

  const enable = async () => {
    try {
      await getAuthRepository().enable2FA(code);
      setEnabled(true);
    } catch {
      setError('Invalid code');
    }
  };

  const disable = async () => {
    try {
      await getAuthRepository().disable2FA(code);
      setEnabled(false);
    } catch {
      setError('Invalid code');
    }
  };

  return (
    <ScreenLayout testID="S-712">
      <ScrollView>
        <Text>2FA: {enabled ? 'Enabled' : 'Disabled'}</Text>
        {!enabled ? <PrimaryButton title="Setup 2FA" onPress={() => void setup()} /> : null}
        {secret ? <Text selectable>Secret: {secret}</Text> : null}
        <TextField label="2FA Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
        {error ? <ErrorBanner message={error} /> : null}
        {enabled ? (
          <PrimaryButton title="Disable 2FA" variant="secondary" onPress={() => void disable()} />
        ) : (
          <PrimaryButton title="Enable 2FA" onPress={() => void enable()} />
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
