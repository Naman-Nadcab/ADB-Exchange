import { View, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, SecondaryButton, Card } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useGoogleOAuth, useAppleOAuth } from '../hooks/useOAuth';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginMethod'>;

export function LoginMethodScreen({ navigation }: Props) {
  const google = useGoogleOAuth();
  const apple = useAppleOAuth();

  return (
    <AuthScreenShell testID="S-101" title="Log in" subtitle="Choose how you want to sign in" onBack={() => navigation.goBack()}>
      <Card elevated style={{ gap: 10 }}>
        <PrimaryButton title="Email or Phone" onPress={() => navigation.navigate('LoginIdentifier')} />
        <PrimaryButton title="Password" variant="secondary" onPress={() => navigation.navigate('LoginPassword')} />
        <PrimaryButton title="Passkey" variant="outline" onPress={() => navigation.navigate('LoginPasskey')} />
        <PrimaryButton title="Google" variant="outline" loading={google.isPending} onPress={() => google.mutate()} />
        {Platform.OS === 'ios' ? (
          <PrimaryButton title="Apple" variant="outline" loading={apple.isPending} onPress={() => apple.mutate()} />
        ) : null}
      </Card>
      <View style={{ marginTop: 16 }}>
        <SecondaryButton title="Create account" onPress={() => navigation.navigate('SignupIdentifier')} />
      </View>
    </AuthScreenShell>
  );
}
