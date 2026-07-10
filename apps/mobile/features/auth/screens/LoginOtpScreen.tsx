import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginOtp'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function LoginOtpScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
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
    <ScreenLayout testID="S-104">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Verify OTP</Text>
      <TextField label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Verify" loading={loading} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
