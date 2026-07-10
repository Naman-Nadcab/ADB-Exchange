import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordResetRequest } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

export function ForgotPasswordRequestScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resetReq = usePasswordResetRequest();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    try {
      await resetReq.mutateAsync({ identifier: identifier.trim() });
      navigation.navigate('ForgotPasswordOtp', { identifier: identifier.trim() });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <ScreenLayout testID="S-110">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Forgot password
      </Text>
      <TextField label="Email or phone" value={identifier} onChangeText={setIdentifier} />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Send OTP" loading={resetReq.isPending} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
