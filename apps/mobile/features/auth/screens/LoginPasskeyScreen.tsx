import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginPasskey'>;

export function LoginPasskeyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter email');
      return;
    }
    setLoading(true);
    try {
      const { available } = await getAuthRepository().passkeyAvailable({ email: email.trim() });
      if (!available) {
        setError('Passkeys not available for this account');
        return;
      }
      const options = await getAuthRepository().passkeyAuthenticateOptions({ email: email.trim() });
      // Native WebAuthn credential flow requires platform passkey module (Sprint 1 hook).
      const challenge = String((options as { challenge?: string }).challenge ?? '');
      if (!challenge) {
        setError('Passkey challenge unavailable');
        return;
      }
      setError('Complete passkey on a device with native WebAuthn support');
      navigation.navigate('LoginPassword');
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout testID="S-105">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Passkey</Text>
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Continue with Passkey" loading={loading} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
