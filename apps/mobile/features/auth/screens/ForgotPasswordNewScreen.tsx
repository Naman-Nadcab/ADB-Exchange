import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, PasswordInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordNew'>;

export function ForgotPasswordNewScreen({ route, navigation }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reset = usePasswordReset();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    try {
      await reset.mutateAsync({
        identifier: route.params.identifier,
        otp: route.params.otp,
        newPassword,
      });
      navigation.navigate('LoginPassword');
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-112" title="New password" subtitle="Choose a strong password" onBack={() => navigation.goBack()}>
      <PasswordInput label="Password" value={newPassword} onChangeText={setNewPassword} />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Reset password" loading={reset.isPending} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
