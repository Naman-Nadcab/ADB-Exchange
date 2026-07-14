import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSendOtp } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupIdentifier'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupIdentifierScreen({ navigation, route }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const { handleAuthError } = useAuthActions();
  const referralCode = route.params?.referralCode;

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError('Enter email or phone');
      return;
    }
    try {
      await sendOtp.mutateAsync({
        identifier: identifier.trim(),
        type: detectType(identifier.trim()),
        purpose: 'signup',
      });
      navigation.navigate('SignupOtp', { identifier: identifier.trim(), referralCode });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthScreenShell testID="S-106" title="Create account" subtitle="Enter your email or phone number" onBack={() => navigation.goBack()}>
      <TextField label="Email or phone" value={identifier} onChangeText={setIdentifier} leftIcon="person-outline" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Send OTP" loading={sendOtp.isPending} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
