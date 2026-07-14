import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginOtp'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function LoginOtpScreen({ route, navigation }: Props) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { completeSession, handleAuthError } = useAuthActions();
  const { identifier } = route.params;

  const submit = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError('Enter 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const type = detectType(identifier);
      const data = await getAuthRepository().loginOtp({
        [type]: identifier,
        otp,
      });
      if ('requiresVerification' in data && data.requiresVerification) {
        navigation.navigate('LoginVerifyStep', {
          verificationToken: data.verificationToken,
          nextStep: data.nextStep,
        });
        return;
      }
      if ('accessToken' in data) await completeSession(data);
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell testID="S-104" title="Verify code" subtitle={`Sent to ${identifier}`} onBack={() => navigation.goBack()}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Verify" loading={loading} onPress={() => void submit()} />
    </AuthScreenShell>
  );
}
