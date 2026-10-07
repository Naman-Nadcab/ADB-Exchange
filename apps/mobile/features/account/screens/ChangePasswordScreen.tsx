import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { ApiError } from '@core/api/errors/ApiError';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    analytics.screen('S-711');
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await getAuthRepository().changePassword({ currentPassword: current, newPassword: next, securityOtp: otp || undefined });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout testID="S-711">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            A password is not a sign-in method. Sign in with your wallet.
          </Text>
          <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
          <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry />
          <TextField label="Security OTP (if required)" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          {error ? <ErrorBanner message={error} /> : null}
          <PrimaryButton title="Change Password" loading={loading} onPress={() => void submit()} />
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
