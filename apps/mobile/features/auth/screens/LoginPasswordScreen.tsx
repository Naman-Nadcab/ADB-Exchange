import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, PasswordInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useLoginPassword } from '../hooks/useLogin';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@shared/theme';

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
    <AuthSplitLayout testID="S-103" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="Welcome back" subtitle="Sign in with your email and password." />
      <TextField
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
      <Pressable onPress={() => navigation.navigate('ForgotPasswordRequest')} style={{ alignSelf: 'flex-end', marginBottom: theme.spacing[4] }}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }]}>
          Forgot password?
        </Text>
      </Pressable>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Sign in" size="xl" loading={login.isPending} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
