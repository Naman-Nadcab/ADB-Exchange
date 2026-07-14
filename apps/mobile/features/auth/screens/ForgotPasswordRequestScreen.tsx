import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordResetRequest } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthIdTypeToggle } from '../components/AuthIdTypeToggle';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

export function ForgotPasswordRequestScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [idType, setIdType] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const resetReq = usePasswordResetRequest();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError('Enter email or phone');
      return;
    }
    try {
      await resetReq.mutateAsync({ identifier: identifier.trim() });
      navigation.navigate('ForgotPasswordOtp', { identifier: identifier.trim() });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-110" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="Forgot password?" subtitle="Enter your email or phone to receive a reset code" />
      <AuthIdTypeToggle value={idType} onChange={setIdType} variant="tabs" />
      <TextField
        placeholder={idType === 'email' ? 'Email address' : 'Mobile number'}
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType={idType === 'email' ? 'email-address' : 'phone-pad'}
        autoCapitalize="none"
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Send reset code" size="xl" loading={resetReq.isPending} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
