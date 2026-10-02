import { View, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useGoogleOAuth, useAppleOAuth } from '../hooks/useOAuth';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';
import { AuthDivider } from '../components/AuthDivider';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginMethod'>;

export function LoginMethodScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const google = useGoogleOAuth();
  const apple = useAppleOAuth();

  return (
    <AuthSplitLayout testID="S-101" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading title="Welcome back" subtitle="Choose how you want to sign in" />
      <View style={{ gap: theme.spacing[3] }}>
        <PrimaryButton title="Email or Phone" size="xl" onPress={() => navigation.navigate('LoginIdentifier')} />
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
        <PrimaryButton
          title="Connect wallet"
          accessibilityLabel="Connect wallet"
          size="xl"
          variant="outline"
          onPress={() => navigation.navigate('LoginWallet')}
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
      </View>
      <PrimaryButton
        title="Create account"
        variant="ghost"
        size="md"
        onPress={() => navigation.navigate('SignupIdentifier')}
        style={{ marginTop: theme.spacing[6] }}
      />
    </AuthSplitLayout>
  );
}
