import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, PasswordInput, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordNew'>;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must include uppercase, lowercase, and a number';
  }
  return null;
}

export function ForgotPasswordNewScreen({ route, navigation }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reset = usePasswordReset();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
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
    <AuthSplitLayout testID="S-112" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="New password" subtitle="Choose a strong password" />
      <PasswordInput placeholder="Min 8 chars, uppercase, lowercase, number" value={newPassword} onChangeText={setNewPassword} />
      <TextField placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Reset password" size="xl" loading={reset.isPending} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
