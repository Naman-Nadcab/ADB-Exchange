import { Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '@shared/ui';
import { useTheme, marketing } from '@shared/theme';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { useAppStore } from '@core/state/appStore';
import { appLock } from '@core/security/appLock';
import { AuthSplitLayout, AuthFormHeading } from '@features/auth';
import {
  getAuthPreviewScreen,
  isAuthPreviewEnabled,
} from '@app/bootstrap/authPreview';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function EnableBiometricsScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'EnableBiometrics'>) {
  const { theme } = useTheme();
  const setPhase = useAppStore((s) => s.setPhase);

  const finish = async (enableBio: boolean) => {
    if (enableBio) {
      const can = await appLock.canUseBiometrics();
      if (can) await appLock.setEnabled(true);
    }
    await mmkvStorage.set(CACHE_KEYS.onboarding, 'complete');
    useAppStore.getState().setOnboardingComplete(true);
    setPhase('main');
  };

  return (
    <AuthSplitLayout testID="S-120" showMarketingLogo>
      <AuthFormHeading
        title="Enable biometrics"
        subtitle="Unlock ADB Exchange quickly when you return to the app."
      />
      <PrimaryButton title="Enable Face ID / Touch ID" size="xl" onPress={() => void finish(true)} />
      <PrimaryButton
        title="Set PIN instead"
        variant="outline"
        size="xl"
        onPress={() => navigation.navigate('PinFallback')}
        style={{ marginTop: theme.spacing[3] }}
      />
      <PrimaryButton
        title="Skip for now"
        variant="ghost"
        size="md"
        onPress={() => void finish(false)}
        style={{ marginTop: theme.spacing[3] }}
      />
    </AuthSplitLayout>
  );
}

function PinFallbackScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'PinFallback'>) {
  const { theme } = useTheme();
  const setPhase = useAppStore((s) => s.setPhase);

  const complete = async () => {
    await mmkvStorage.set(CACHE_KEYS.onboarding, 'complete');
    useAppStore.getState().setOnboardingComplete(true);
    setPhase('main');
  };

  return (
    <AuthSplitLayout testID="S-123" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title="PIN fallback"
        subtitle="Configure a PIN backup in Security Center after you enter the app."
      />
      <Text style={[styles.note, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        App lock PIN setup is available under Account → Security Center → App Lock.
      </Text>
      <PrimaryButton title="Continue to Markets" size="xl" onPress={() => void complete()} />
    </AuthSplitLayout>
  );
}

export function OnboardingNavigator() {
  const previewScreen = isAuthPreviewEnabled() ? getAuthPreviewScreen() : null;
  const initialRouteName = (previewScreen ?? 'EnableBiometrics') as keyof OnboardingStackParamList;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: marketing.pageBg } }}
      initialRouteName={initialRouteName}
    >
      <Stack.Screen name="EnableBiometrics" component={EnableBiometricsScreen} />
      <Stack.Screen name="PinFallback" component={PinFallbackScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
});
