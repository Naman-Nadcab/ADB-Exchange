import { Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-100">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>METHErium</Text>
      <Text style={[styles.sub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Trade crypto with confidence
      </Text>
      <View style={styles.actions}>
        <PrimaryButton title="Get Started" onPress={() => navigation.navigate('SignupIdentifier')} />
        <PrimaryButton
          title="Log In"
          variant="secondary"
          onPress={() => navigation.navigate('LoginMethod')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '700', marginTop: 48 },
  sub: { fontSize: 16, marginTop: 8, marginBottom: 32 },
  actions: { gap: 12 },
});
