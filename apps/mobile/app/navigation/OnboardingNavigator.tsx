import { Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { useAppStore } from '@core/state/appStore';
import { appLock } from '@core/security/appLock';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function EnableBiometricsScreen() {
  const { theme } = useTheme();
  const setPhase = useAppStore((s) => s.setPhase);

  const enable = async () => {
    const can = await appLock.canUseBiometrics();
    if (can) await appLock.setEnabled(true);
    await mmkvStorage.set(CACHE_KEYS.onboarding, 'complete');
    useAppStore.getState().setOnboardingComplete(true);
    setPhase('main');
  };

  const skip = async () => {
    await mmkvStorage.set(CACHE_KEYS.onboarding, 'complete');
    useAppStore.getState().setOnboardingComplete(true);
    setPhase('main');
  };

  return (
    <ScreenLayout testID="S-120">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Enable biometrics
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Unlock METHErium quickly when returning to the app.
      </Text>
      <PrimaryButton title="Enable" onPress={() => void enable()} />
      <PrimaryButton title="Skip" variant="secondary" onPress={() => void skip()} />
    </ScreenLayout>
  );
}

function PinFallbackScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-123">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>PIN fallback</Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Set a PIN as backup when biometrics are unavailable.
      </Text>
    </ScreenLayout>
  );
}

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EnableBiometrics" component={EnableBiometricsScreen} />
      <Stack.Screen name="PinFallback" component={PinFallbackScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 24 },
});
