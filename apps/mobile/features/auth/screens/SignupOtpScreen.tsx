import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupOtp'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupOtpScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
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
    <ScreenLayout testID="S-107">
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
