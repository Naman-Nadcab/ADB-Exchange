import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { getApiBaseUrl } from '@core/config/env';
import { legacyCustomerEntryAvailable } from '@core/auth/legacyEntry';
import { useGoogleOAuth, useAppleOAuth } from '../hooks/useOAuth';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthDivider } from '../components/AuthDivider';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginMethod'>;

export function LoginMethodScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const google = useGoogleOAuth();
  const apple = useAppleOAuth();
  const [legacyEntryAvailable, setLegacyEntryAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/auth/wallet-cutover`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { data?: { legacyEntryAvailable?: boolean } } | null) => {
        if (!cancelled) setLegacyEntryAvailable(body?.data?.legacyEntryAvailable === true);
      })
      .catch(() => {
        if (!cancelled) setLegacyEntryAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthSplitLayout testID="S-101" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title="Welcome back"
        subtitle={legacyEntryAvailable === true ? 'Choose how you want to sign in' : 'Sign in with your wallet'}
      />
      <View style={{ gap: theme.spacing[3] }}>
        <PrimaryButton
          title="Connect wallet"
          accessibilityLabel="Connect wallet"
          size="xl"
          onPress={() => navigation.navigate('LoginWallet')}
        />
        {legacyEntryAvailable !== true ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>
            Email, phone, password, and social login are not a sign-in method.
          </Text>
        ) : null}
        {legacyEntryAvailable === true ? (
          <>
            <PrimaryButton title="Email or Phone" size="xl" variant="outline" onPress={() => navigation.navigate('LoginIdentifier')} />
            <PrimaryButton
              title="Password"
              size="xl"
              variant="outline"
              onPress={() => navigation.navigate('LoginPassword')}
            />
            <PrimaryButton
              title="Passkey"
              size="xl"
              variant="outline"
              onPress={() => navigation.navigate('LoginPasskey')}
            />
            <AuthDivider />
            <PrimaryButton
              title="Google"
              size="xl"
              variant="outline"
              loading={google.isPending}
              onPress={() => google.mutate()}
            />
            {Platform.OS === 'ios' ? (
              <PrimaryButton
                title="Apple"
                size="xl"
                variant="outline"
                loading={apple.isPending}
                onPress={() => apple.mutate()}
              />
            ) : null}
          </>
        ) : null}
      </View>
      {legacyEntryAvailable === true ? (
        <PrimaryButton
          title="Create account"
          variant="ghost"
          size="md"
          onPress={() => navigation.navigate('SignupIdentifier')}
          style={{ marginTop: theme.spacing[6] }}
        />
      ) : null}
    </AuthSplitLayout>
  );
}
