import { useState } from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, PasswordInput, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthProgressBar } from '../components/AuthProgressBar';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupPassword'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

function validatePassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 30 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

export function SignupPasswordScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();
  const { handleAuthError } = useAuthActions();
  const validPass = validatePassword(password);

  const submit = async () => {
    setError(null);
    if (!validPass) {
      setError('Needs: 8+ chars, upper & lower case, number');
      return;
    }
    const type = detectType(route.params.identifier);
    try {
      await signup.mutateAsync({
        [type]: route.params.identifier,
        password,
        referralCode: route.params.referralCode,
      });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-108" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthProgressBar steps={4} currentIndex={3} />
      <AuthFormHeading title="Create your password" subtitle="8+ chars, include upper, lower & number" />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
      <View style={{ gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing[1] }}>
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: theme.radius.full,
              backgroundColor: password.length >= 8 ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.surfaceAccent})`,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: theme.radius.full,
              backgroundColor:
                /[A-Z]/.test(password) && /[a-z]/.test(password)
                  ? `hsl(${theme.colors.brandPrimary})`
                  : `hsl(${theme.colors.surfaceAccent})`,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: theme.radius.full,
              backgroundColor: /[0-9]/.test(password) ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.surfaceAccent})`,
            }}
          />
        </View>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          {validPass ? 'Strong password' : 'Needs: 8+ chars, upper & lower case, number'}
        </Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Create account" size="xl" loading={signup.isPending} disabled={!validPass} onPress={() => void submit()} />
      <PrimaryButton
        title="Add referral code"
        variant="ghost"
        size="md"
        onPress={() =>
          navigation.navigate('SignupReferral', {
            identifier: route.params.identifier,
            password,
          })
        }
        style={{ marginTop: theme.spacing[3] }}
      />
    </AuthSplitLayout>
  );
}
