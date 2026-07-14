import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupReferral'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupReferralScreen({ route, navigation }: Props) {
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    const type = detectType(route.params.identifier);
    try {
      await signup.mutateAsync({
        [type]: route.params.identifier,
        password: route.params.password,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-109" title="Referral code" subtitle="Optional — unlock fee discounts" onBack={() => navigation.goBack()}>
      <TextField label="Code (optional)" value={referralCode} onChangeText={setReferralCode} leftIcon="gift-outline" autoCapitalize="characters" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Finish signup" loading={signup.isPending} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
