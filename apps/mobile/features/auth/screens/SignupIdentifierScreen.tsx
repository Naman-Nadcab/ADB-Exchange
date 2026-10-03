import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, TextField, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useSendOtp } from '../hooks/useSignup';
import { useGoogleOAuth } from '../hooks/useOAuth';
import { useAuthActions } from '../hooks/useAuthActions';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthProgressBar } from '../components/AuthProgressBar';
import { AuthDivider } from '../components/AuthDivider';
import { AuthTermsCheckbox } from '../components/AuthTermsCheckbox';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupIdentifier'>;

export function SignupIdentifierScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const idType = route.params?.idType;
  const referralFromRoute = route.params?.referralCode;
  const [identifier, setIdentifier] = useState('');
  const [referralCode, setReferralCode] = useState(referralFromRoute ?? '');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const google = useGoogleOAuth();
  const { handleAuthError } = useAuthActions();

  const submitContact = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError(idType === 'phone' ? 'Enter phone number' : 'Enter email address');
      return;
    }
    try {
      await sendOtp.mutateAsync({
        identifier: identifier.trim(),
        type: idType ?? 'email',
        purpose: 'signup',
      });
      navigation.navigate('SignupOtp', {
        identifier: identifier.trim(),
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      setError(handleAuthError(err));
    }
  };

  if (!idType) {
    return (
      <AuthSplitLayout testID="S-106" showMarketingLogo onBack={() => navigation.goBack()}>
        <AuthProgressBar steps={4} currentIndex={0} />
        <AuthFormHeading title="Create your account" subtitle="Get started with Google, email, or mobile" />
        <AuthTermsCheckbox checked={terms} onChange={setTerms} />
        {error ? <ErrorBanner message={error} /> : null}
        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
          <PrimaryButton
            title="Sign up with Google"
            size="xl"
            variant="outline"
            loading={google.isPending}
            disabled={!terms}
            onPress={() => {
              if (!terms) {
                setError('Accept Terms & Privacy to continue');
                return;
              }
              google.mutate();
            }}
          />
          <PrimaryButton
            title="Sign up with wallet"
            accessibilityLabel="Sign up with wallet"
            size="xl"
            variant="outline"
            disabled={!terms}
            onPress={() => {
              if (!terms) {
                setError('Accept Terms & Privacy to continue');
                return;
              }
              navigation.navigate('LoginWallet', { intent: 'signup' });
            }}
          />
          <AuthDivider />
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <Pressable
              disabled={!terms}
              onPress={() =>
                navigation.navigate('SignupIdentifier', {
                  idType: 'email',
                  referralCode: referralFromRoute,
                })
              }
              style={{
                flex: 1,
                paddingVertical: theme.spacing[4],
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: `hsl(${theme.colors.borderDefault})`,
                alignItems: 'center',
                gap: theme.spacing[2],
                opacity: terms ? 1 : 0.5,
              }}
            >
              <Ionicons name="mail-outline" size={24} color={`hsl(${theme.colors.foregroundSecondary})`} />
              <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansMedium, color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                Email
              </Text>
            </Pressable>
            <Pressable
              disabled={!terms}
              onPress={() =>
                navigation.navigate('SignupIdentifier', {
                  idType: 'phone',
                  referralCode: referralFromRoute,
                })
              }
              style={{
                flex: 1,
                paddingVertical: theme.spacing[4],
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: `hsl(${theme.colors.borderDefault})`,
                alignItems: 'center',
                gap: theme.spacing[2],
                opacity: terms ? 1 : 0.5,
              }}
            >
              <Ionicons name="phone-portrait-outline" size={24} color={`hsl(${theme.colors.foregroundSecondary})`} />
              <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansMedium, color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                Mobile
              </Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => navigation.navigate('LoginPassword')} style={{ marginTop: theme.spacing[6] }}>
          <Text style={[theme.typography.bodyMd, { textAlign: 'center', color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Have an account?{' '}
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }}>
              Log in
            </Text>
          </Text>
        </Pressable>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout testID="S-106-contact" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthProgressBar steps={4} currentIndex={1} />
      <Pressable onPress={() => navigation.navigate('SignupIdentifier', { referralCode: referralFromRoute })}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium, marginBottom: theme.spacing[3] }]}>
          ← Back
        </Text>
      </Pressable>
      <AuthFormHeading
        title={`Sign up with ${idType === 'email' ? 'Email' : 'Mobile'}`}
        subtitle="We'll send you a verification code"
      />
      <TextField
        placeholder={idType === 'email' ? 'Email address' : 'Phone number'}
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType={idType === 'email' ? 'email-address' : 'phone-pad'}
        autoCapitalize="none"
      />
      <TextField
        placeholder="Referral code (optional)"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="characters"
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton
        title="Send verification code"
        size="xl"
        loading={sendOtp.isPending}
        onPress={() => void submitContact()}
      />
    </AuthSplitLayout>
  );
}
