import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, PasswordInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useLoginPassword } from '../hooks/useLogin';
import { useAuthActions } from '../hooks/useAuthActions';
import { dismissAuthFromModal } from '@core/guest/guestMode';
import { isAuthModalVisible } from '@app/navigation/navigationRef';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthDivider } from '../components/AuthDivider';
import { useTheme } from '@shared/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPassword'>;

export function LoginPasswordScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [resetBanner, setResetBanner] = useState(!!route.params?.resetSuccess);
  const login = useLoginPassword();
  const { handleAuthError } = useAuthActions();

  useEffect(() => {
    if (route.params?.resetSuccess) setResetBanner(true);
  }, [route.params?.resetSuccess]);

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length < 5 || !trimmed.includes('@')) {
      setPasskeyAvailable(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void getAuthRepository()
        .passkeyAvailable({ email: trimmed })
        .then((res) => {
          if (!cancelled) setPasskeyAvailable(!!res.available);
        })
        .catch(() => {
          if (!cancelled) setPasskeyAvailable(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email]);

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

  const passkeyLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email first');
      return;
    }
    setPasskeyLoading(true);
    setError(null);
    try {
      navigation.navigate('LoginPasskey', { email: trimmed });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      testID="S-103"
      showMarketingLogo
      onBack={() => {
        if (isAuthModalVisible()) dismissAuthFromModal();
        else if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Welcome');
      }}
    >
      {resetBanner ? (
        <View
          style={{
            padding: theme.spacing[3],
            marginBottom: theme.spacing[4],
            borderRadius: theme.radius.lg,
            backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
            borderWidth: 1,
            borderColor: `hsl(${theme.colors.brandPrimary} / 0.3)`,
          }}
        >
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            Password reset successful. Log in with your new password.
          </Text>
        </View>
      ) : null}
      <AuthFormHeading title="Welcome back" subtitle="Sign in with your email and password." />
      <TextField
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
      <Pressable
        onPress={() => navigation.navigate('ForgotPasswordRequest')}
        style={{ alignSelf: 'flex-end', marginBottom: theme.spacing[4] }}
      >
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }]}>
          Forgot password?
        </Text>
      </Pressable>

      {passkeyAvailable ? (
        <>
          <View
            style={{
              padding: theme.spacing[4],
              borderRadius: theme.radius.lg,
              backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
              borderWidth: 1,
              borderColor: `hsl(${theme.colors.borderDefault})`,
              marginBottom: theme.spacing[2],
            }}
          >
            <PrimaryButton
              title="Login with Passkey"
              size="xl"
              loading={passkeyLoading}
              onPress={() => void passkeyLogin()}
            />
          </View>
          <AuthDivider />
        </>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton
        title="Sign in"
        size="xl"
        loading={login.isPending}
        disabled={!email.trim() || !password}
        onPress={() => void submit()}
      />

      <AuthDivider />
      <PrimaryButton
        title="Sign in with one-time code"
        size="xl"
        variant="outline"
        onPress={() => navigation.navigate('LoginIdentifier')}
      />

      <Pressable onPress={() => navigation.navigate('SignupIdentifier')} style={{ marginTop: theme.spacing[6] }}>
        <Text style={[theme.typography.bodyMd, { textAlign: 'center', color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Don&apos;t have an account?{' '}
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }}>Sign up</Text>
        </Text>
      </Pressable>
    </AuthSplitLayout>
  );
}
