import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupOtp'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupOtpScreen({ route, navigation }: Props) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const type = detectType(route.params.identifier);
      await getAuthRepository().verifyOtp({
        identifier: route.params.identifier,
        otp,
        type,
        purpose: 'signup',
      });
      navigation.navigate('SignupPassword', {
        identifier: route.params.identifier,
        referralCode: route.params.referralCode,
      });
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell testID="S-107" title="Verify OTP" subtitle={`Code sent to ${route.params.identifier}`} onBack={() => navigation.goBack()}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Verify" loading={loading} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
