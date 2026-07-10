import { Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useGoogleOAuth, useAppleOAuth } from '../hooks/useOAuth';
import { Platform } from 'react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginMethod'>;

export function LoginMethodScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const google = useGoogleOAuth();
  const apple = useAppleOAuth();

  return (
    <ScreenLayout testID="S-101">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Log in</Text>
      <View style={styles.actions}>
        <PrimaryButton title="Email or Phone" onPress={() => navigation.navigate('LoginIdentifier')} />
        <PrimaryButton title="Password" onPress={() => navigation.navigate('LoginPassword')} />
        <PrimaryButton title="Passkey" onPress={() => navigation.navigate('LoginPasskey')} />
        <PrimaryButton title="Google" loading={google.isPending} onPress={() => google.mutate()} />
        {Platform.OS === 'ios' ? (
          <PrimaryButton title="Apple" loading={apple.isPending} onPress={() => apple.mutate()} />
        ) : null}
        <PrimaryButton
          title="Create account"
          variant="secondary"
          onPress={() => navigation.navigate('SignupIdentifier')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 24 },
  actions: { gap: 12 },
});
