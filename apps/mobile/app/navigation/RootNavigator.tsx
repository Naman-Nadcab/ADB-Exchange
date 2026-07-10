import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';
import { linking } from './linking';
import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { AccountStackNavigator } from '@features/account';
import type { RootStackParamList } from './types';
import { runLaunchFlow, waitBootTimeout } from '@app/bootstrap/launchFlow';
import {
  SplashScreen,
  ForceUpdateScreen,
  MaintenanceScreen,
  OfflineGateScreen,
  SanctionsBlockedScreen,
  AccountRestrictedScreen,
  RateLimitedScreen,
  AppLockScreen,
} from '@features/app-shell';
import { appLock } from '@core/security/appLock';

const Stack = createNativeStackNavigator<RootStackParamList>();

function ShellGateOverlay() {
  const gate = useAppStore((s) => s.shellGate);
  switch (gate) {
    case 'forceUpdate':
      return <ForceUpdateScreen />;
    case 'maintenance':
      return <MaintenanceScreen />;
    case 'offline':
      return <OfflineGateScreen />;
    case 'sanctions':
      return <SanctionsBlockedScreen />;
    case 'restricted':
      return <AccountRestrictedScreen />;
    case 'rateLimited':
      return <RateLimitedScreen />;
    case 'appLock':
      return <AppLockScreen />;
    default:
      return null;
  }
}

export function RootNavigator() {
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const shellGate = useAppStore((s) => s.shellGate);
  const authResolved = useAuthStore((s) => s.authResolved);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [, result] = await Promise.all([waitBootTimeout(), runLaunchFlow()]);
      if (cancelled) return;
      setPhase(result.phase);
      setBootDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setPhase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') useAuthStore.getState().touchActivity();
      if (state === 'active') {
        const enabled = await appLock.isEnabled();
        if (!enabled) return;
        const timeoutSec = await appLock.getTimeoutSec();
        const idleMs = Date.now() - useAuthStore.getState().lastActiveAt;
        if (idleMs > timeoutSec * 1000) {
          useAppStore.getState().setShellGate('appLock');
        }
        useAuthStore.getState().touchActivity();
      }
    });
    return () => sub.remove();
  }, []);

  if (!bootDone || !authResolved) {
    return <SplashScreen />;
  }

  if (shellGate !== 'none' && shellGate !== 'restricted') {
    return <ShellGateOverlay />;
  }

  return (
    <NavigationContainer linking={linking as LinkingOptions<RootStackParamList>}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {phase === 'auth' && <Stack.Screen name="Auth" component={AuthNavigator} />}
        {phase === 'onboarding' && (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        )}
        {phase === 'main' && (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="Account"
              component={AccountStackNavigator}
              options={{ presentation: 'modal', headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
      {shellGate === 'restricted' ? <AccountRestrictedScreen /> : null}
    </NavigationContainer>
  );
}
