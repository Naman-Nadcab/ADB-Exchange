import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginVerifyStep'>;

export function LoginVerifyStepScreen({ route }: Props) {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { completeSession, handleAuthError } = useAuthActions();

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuthRepository().loginVerifyStep({
        verificationToken: route.params.verificationToken,
        step: route.params.nextStep,
        code,
      });
      if ('accessToken' in data) await completeSession(data);
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout testID="S-104-verify">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Additional verification
      </Text>
      <TextField label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Continue" loading={loading} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
