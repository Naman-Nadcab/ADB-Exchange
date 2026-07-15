import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthMarketingPanel } from '../components/AuthMarketingPanel';
import { useGuestAccess } from '../hooks/useGuestAccess';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { continueAsGuest } = useGuestAccess();

  return (
    <AuthSplitLayout testID="S-100" showMarketingLogo>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 240 }}>
        <Text
          style={[
            theme.typography.displayMd,
            {
              color: `hsl(${theme.colors.foregroundPrimary})`,
              textAlign: 'center',
              fontFamily: theme.fonts.sansSemiBold,
            },
          ]}
        >
          Trade crypto with{' '}
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>confidence</Text>
        </Text>
        <Text
          style={[
            theme.typography.bodyLg,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              textAlign: 'center',
              marginTop: theme.spacing[3],
              marginBottom: theme.spacing[2],
            },
          ]}
        >
          Secure spot trading and P2P — built for speed and reliability.
        </Text>
        <AuthMarketingPanel />
      </View>
      <PrimaryButton title="Continue as Guest" size="xl" onPress={continueAsGuest} />
      <PrimaryButton
        title="Get Started"
        variant="outline"
        size="xl"
        onPress={() => navigation.navigate('SignupIdentifier')}
        style={{ marginTop: theme.spacing[3] }}
      />
      <PrimaryButton
        title="Log In"
        variant="ghost"
        size="md"
        onPress={() => navigation.navigate('LoginPassword')}
        style={{ marginTop: theme.spacing[3] }}
      />
    </AuthSplitLayout>
  );
}
