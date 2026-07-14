import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPasskey'>;

export function LoginPasskeyScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter email');
      return;
    }
    setLoading(true);
    try {
      const { available } = await getAuthRepository().passkeyAvailable({ email: email.trim() });
      if (!available) {
        setError('Passkeys not available for this account');
        return;
      }
      const options = await getAuthRepository().passkeyAuthenticateOptions({ email: email.trim() });
      const challenge = String((options as { challenge?: string }).challenge ?? '');
      if (!challenge) {
        setError('Passkey challenge unavailable');
        return;
      }
      setError('Complete passkey on a device with native WebAuthn support');
      navigation.navigate('LoginPassword');
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell testID="S-105" title="Passkey" subtitle="Sign in with your device biometrics" onBack={() => navigation.goBack()}>
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" leftIcon="finger-print-outline" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Continue with Passkey" loading={loading} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
