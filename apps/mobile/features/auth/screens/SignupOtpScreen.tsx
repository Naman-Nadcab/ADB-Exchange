import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthProgressBar } from '../components/AuthProgressBar';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupOtp'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupOtpScreen({ route, navigation }: Props) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAuthError } = useAuthActions();
  const idType = detectType(route.params.identifier);

  const submit = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError('Enter 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await getAuthRepository().verifyOtp({
        identifier: route.params.identifier,
        otp,
        type: idType,
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
    <AuthSplitLayout testID="S-107" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthProgressBar steps={4} currentIndex={2} />
      <AuthFormHeading
        title={`Verify your ${idType}`}
        subtitle={`Code sent to ${route.params.identifier}`}
      />
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Verify" size="xl" loading={loading} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
