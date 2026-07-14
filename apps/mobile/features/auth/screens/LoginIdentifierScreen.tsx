import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSendOtp } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthProgressBar } from '../components/AuthProgressBar';
import { AuthIdTypeToggle } from '../components/AuthIdTypeToggle';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginIdentifier'>;

export function LoginIdentifierScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [idType, setIdType] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError('Enter email or phone');
      return;
    }
    try {
      await sendOtp.mutateAsync({
        identifier: identifier.trim(),
        type: idType,
        purpose: 'login',
      });
      navigation.navigate('LoginOtp', { identifier: identifier.trim() });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-102" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthProgressBar steps={2} currentIndex={0} />
      <AuthFormHeading title="Sign in with code" subtitle="We'll send a one-time code to your email or mobile." />
      <AuthIdTypeToggle value={idType} onChange={setIdType} />
      <TextField
        placeholder={idType === 'email' ? 'Email address' : 'Phone number'}
        value={identifier}
        onChangeText={setIdentifier}
        testID="login-identifier"
        keyboardType={idType === 'email' ? 'email-address' : 'phone-pad'}
        autoCapitalize="none"
      />
      {error ? <ErrorBanner message={error} onRetry={submit} /> : null}
      <PrimaryButton title="Send sign-in code" size="xl" loading={sendOtp.isPending} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
