import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, PasswordInput, ErrorBanner, SecondaryButton } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useLoginPassword } from '../hooks/useLogin';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPassword'>;

export function LoginPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useLoginPassword();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter email and password');
      return;
    }
    try {
      await login.mutateAsync({ email: email.trim(), password });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-103" title="Password" subtitle="Sign in with your credentials" onBack={() => navigation.goBack()}>
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" leftIcon="mail-outline" />
      <PasswordInput label="Password" value={password} onChangeText={setPassword} />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Log in" loading={login.isPending} onPress={() => void submit()} />
      <SecondaryButton title="Forgot password?" onPress={() => navigation.navigate('ForgotPasswordRequest')} />
    </AuthScreenShell>
  );
}
