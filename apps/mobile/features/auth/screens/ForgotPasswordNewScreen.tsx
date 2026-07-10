import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordNew'>;

export function ForgotPasswordNewScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reset = usePasswordReset();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    try {
      await reset.mutateAsync({
        identifier: route.params.identifier,
        otp: route.params.otp,
        newPassword,
      });
      navigation.navigate('LoginPassword');
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <ScreenLayout testID="S-112">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        New password
      </Text>
      <TextField label="Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Reset password" loading={reset.isPending} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
