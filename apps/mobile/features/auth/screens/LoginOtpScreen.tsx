import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput, ErrorBanner } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useSendOtp } from '../hooks/useSignup';
import { useAuthActions } from '../hooks/useAuthActions';
import { useOtpCountdown } from '../hooks/useOtpCountdown';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { useTheme } from '@shared/theme';

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
  const sendOtp = useSendOtp();
  const { formatted, reset, canResend } = useOtpCountdown(120);
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

  const resend = async () => {
    if (!canResend) return;
    setError(null);
    try {
      await sendOtp.mutateAsync({
        identifier,
        type: detectType(identifier),
        purpose: 'login',
      });
      reset(120);
      setOtp('');
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-104" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title="Enter verification code"
        subtitle={`We sent a 6-digit code to ${identifier}`}
      />
      <Pressable onPress={() => navigation.navigate('LoginIdentifier')} style={{ marginBottom: theme.spacing[3] }}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }]}>
          Change email or phone
        </Text>
      </Pressable>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
        <Pressable onPress={() => void resend()} disabled={!canResend}>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: canResend ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansMedium,
              },
            ]}
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
        title="Verify & continue"
        size="xl"
        loading={loading}
        disabled={otp.length !== 6}
        onPress={() => void submit()}
      />
    </AuthSplitLayout>
  );
}
