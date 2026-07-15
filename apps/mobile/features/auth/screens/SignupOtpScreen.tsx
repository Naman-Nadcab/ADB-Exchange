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
import { AuthProgressBar } from '../components/AuthProgressBar';
import { useTheme } from '@shared/theme';

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
  const sendOtp = useSendOtp();
  const { formatted, reset, canResend } = useOtpCountdown(120);
  const idType = detectType(route.params.identifier);

  const submit = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError('Enter 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await getAuthRepository().verifyOtp({
        identifier: route.params.identifier,
        otp,
        type: idType,
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

  const resend = async () => {
    if (!canResend) return;
    setError(null);
    try {
      await sendOtp.mutateAsync({
        identifier: route.params.identifier,
        type: idType,
        purpose: 'signup',
      });
      reset(120);
      setOtp('');
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  return (
    <AuthSplitLayout testID="S-107" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthProgressBar steps={4} currentIndex={2} />
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: theme.spacing[3] }}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
          ← Back
        </Text>
      </Pressable>
      <AuthFormHeading
        title={`Verify your ${idType}`}
        subtitle={`Code sent to ${route.params.identifier}`}
      />
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={!!error} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
        <Pressable onPress={() => void resend()} disabled={!canResend || sendOtp.isPending}>
          <Text
            style={{
              color: canResend ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
            }}
          >
            Resend
          </Text>
        </Pressable>
        {formatted ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontVariant: ['tabular-nums'] }}>
            {formatted}
          </Text>
        ) : null}
      </View>
      <PrimaryButton title="Verify" size="xl" loading={loading} disabled={otp.length !== 6} onPress={() => void submit()} />
    </AuthSplitLayout>
  );
}
