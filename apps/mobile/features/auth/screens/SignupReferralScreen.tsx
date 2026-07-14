import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

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
    <AuthSplitLayout testID="S-109" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="Referral code" subtitle="Optional — unlock fee discounts" />
      <TextField placeholder="Code (optional)" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Finish signup" size="xl" loading={signup.isPending} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
