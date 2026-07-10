import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSendOtp } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupIdentifier'>;

function detectType(id: string): 'email' | 'phone' {
  return id.includes('@') ? 'email' : 'phone';
}

export function SignupIdentifierScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const { handleAuthError } = useAuthActions();
  const referralCode = route.params?.referralCode;

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError('Enter email or phone');
      return;
    }
    try {
      await sendOtp.mutateAsync({
        identifier: identifier.trim(),
        type: detectType(identifier.trim()),
        purpose: 'signup',
      });
      navigation.navigate('SignupOtp', { identifier: identifier.trim(), referralCode });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <ScreenLayout testID="S-106">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Sign up</Text>
      <TextField label="Email or phone" value={identifier} onChangeText={setIdentifier} />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton title="Send OTP" loading={sendOtp.isPending} onPress={() => void submit()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
