import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordResetRequest } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

export function ForgotPasswordRequestScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resetReq = usePasswordResetRequest();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    try {
      await resetReq.mutateAsync({ identifier: identifier.trim() });
      navigation.navigate('ForgotPasswordOtp', { identifier: identifier.trim() });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-110" title="Forgot password" subtitle="We'll send a reset code" onBack={() => navigation.goBack()}>
      <TextField label="Email or phone" value={identifier} onChangeText={setIdentifier} leftIcon="mail-outline" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Send OTP" loading={resetReq.isPending} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
