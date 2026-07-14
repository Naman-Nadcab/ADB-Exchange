import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, PasswordInput, ErrorBanner, SecondaryButton } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

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
    <AuthScreenShell testID="S-108" title="Create password" subtitle="Use 8–30 characters with mixed case and a number" onBack={() => navigation.goBack()}>
      <PasswordInput label="Password" value={password} onChangeText={setPassword} hint="Never share your password with anyone" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Create account" loading={signup.isPending} onPress={() => void submit()} />
      <SecondaryButton
        title="Add referral code"
        onPress={() =>
          navigation.navigate('SignupReferral', {
            identifier: route.params.identifier,
            password,
          })
        }
      />
    </AuthScreenShell>
  );
}
