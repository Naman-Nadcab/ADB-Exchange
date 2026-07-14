import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginVerifyStep'>;

export function LoginVerifyStepScreen({ route, navigation }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { completeSession, handleAuthError } = useAuthActions();

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuthRepository().loginVerifyStep({
        verificationToken: route.params.verificationToken,
        step: route.params.nextStep,
        code,
      });
      if ('accessToken' in data) await completeSession(data);
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell testID="S-104-verify" title="Additional verification" subtitle="Enter your 2FA code" onBack={() => navigation.goBack()}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={code} onChange={setCode} length={6} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Continue" loading={loading} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
