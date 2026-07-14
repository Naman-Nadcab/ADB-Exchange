import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, SecondaryButton } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <AuthScreenShell testID="S-100" subtitle="Trade crypto with confidence">
      <View style={{ flex: 1 }} />
      <PrimaryButton title="Get Started" onPress={() => navigation.navigate('SignupIdentifier')} />
      <SecondaryButton title="Log In" onPress={() => navigation.navigate('LoginMethod')} />
    </AuthScreenShell>
  );
}
