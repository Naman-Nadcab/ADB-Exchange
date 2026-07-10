import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupPassword'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 30) return 'Password must be 8–30 characters';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Include uppercase, lowercase, and a number';
  }
  return null;
}

export function SignupPasswordScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
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
    <ScreenLayout testID="S-108">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Create password</Text>
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Create account" loading={signup.isPending} onPress={() => void submit()} />
      <PrimaryButton
        title="Add referral code"
        variant="secondary"
        onPress={() =>
          navigation.navigate('SignupReferral', {
            identifier: route.params.identifier,
            password,
          })
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
