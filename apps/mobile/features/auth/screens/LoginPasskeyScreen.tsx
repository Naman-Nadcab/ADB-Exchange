import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPasskey'>;

export function LoginPasskeyScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email first');
      return;
    }
    setLoading(true);
    try {
      const { available } = await getAuthRepository().passkeyAvailable({ email: email.trim() });
      if (!available) {
        setError('Passkey not available for this account');
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
    <AuthSplitLayout testID="S-105" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="Login with Passkey" subtitle="Sign in with your device biometrics" />
      <TextField placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Login with Passkey" size="xl" loading={loading} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
