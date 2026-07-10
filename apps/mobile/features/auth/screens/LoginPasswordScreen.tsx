import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useLoginPassword } from '../hooks/useLogin';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPassword'>;

export function LoginPasswordScreen({ navigation }: Props) {
  const { theme } = useTheme();
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
    <ScreenLayout testID="S-103">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Password</Text>
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Log in" loading={login.isPending} onPress={() => void submit()} />
      <PrimaryButton
        title="Forgot password?"
        variant="secondary"
        onPress={() => navigation.navigate('ForgotPasswordRequest')}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
