import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { usePasswordResetRequest } from '../hooks/usePasswordReset';
import { useAuthActions } from '../hooks/useAuthActions';
import { useOtpCountdown } from '../hooks/useOtpCountdown';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { useTheme } from '@shared/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

export function ForgotPasswordOtpScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resetReq = usePasswordResetRequest();
  const { handleAuthError } = useAuthActions();
  const { formatted, reset, canResend } = useOtpCountdown(60);

  const resend = async () => {
    if (!canResend) return;
    setError(null);
    try {
      await resetReq.mutateAsync({ identifier: route.params.identifier });
      reset(60);
      setOtp('');
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-111" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title="Reset password"
        subtitle={`Enter the 6-digit code sent to ${route.params.identifier}`}
      />
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
        <Pressable onPress={() => void resend()} disabled={!canResend}>
          <Text
            style={{
              color: canResend ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
            }}
          >
            Resend code
          </Text>
        </Pressable>
        {formatted ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontVariant: ['tabular-nums'] }}>
            {formatted}
          </Text>
        ) : null}
      </View>
      <PrimaryButton
        title="Continue"
        size="xl"
        disabled={otp.length !== 6}
        onPress={() =>
          navigation.navigate('ForgotPasswordNew', { identifier: route.params.identifier, otp })
        }
      />
    </AuthSplitLayout>
  );
}
