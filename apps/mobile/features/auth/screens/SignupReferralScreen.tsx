import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSignup } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupReferral'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupReferralScreen({ route }: Props) {
  const { theme } = useTheme();
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();
  const { handleAuthError } = useAuthActions();

  const submit = async () => {
    setError(null);
    const type = detectType(route.params.identifier);
    try {
      await signup.mutateAsync({
        [type]: route.params.identifier,
        password: route.params.password,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <ScreenLayout testID="S-109">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Referral code</Text>
      <TextField label="Code (optional)" value={referralCode} onChangeText={setReferralCode} />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Finish signup" loading={signup.isPending} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
