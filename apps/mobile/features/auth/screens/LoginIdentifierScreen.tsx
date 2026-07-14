import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSendOtp } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginIdentifier'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function LoginIdentifierScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError('Enter email or phone');
      return;
    }
    try {
      await sendOtp.mutateAsync({
        identifier: identifier.trim(),
        type: detectType(identifier.trim()),
        purpose: 'login',
      });
      navigation.navigate('LoginOtp', { identifier: identifier.trim() });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-102" title="Email or phone" subtitle="We'll send a one-time code" onBack={() => navigation.goBack()}>
      <TextField label="Email or phone" value={identifier} onChangeText={setIdentifier} testID="login-identifier" leftIcon="mail-outline" />
      {error ? <ErrorBanner message={error} onRetry={submit} /> : null}
      <PrimaryButton title="Continue" loading={sendOtp.isPending} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
