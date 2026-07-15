import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore } from '@core/state/appStore';
import { useAuthStore } from '@core/state/authStore';
import { isCertPreviewEnabled } from '@app/bootstrap/certPreview';
import { linking } from './linking';
import { exchangeNavigationTheme } from './navigationTheme';
import { navigationRef, resetRoot } from './navigationRef';
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

function CertAccountOpener() {
  useEffect(() => {
    if (!isCertPreviewEnabled() || process.env.EXPO_PUBLIC_CERT_OPEN_ACCOUNT !== '1') return;
    const timer = setInterval(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Account', { screen: 'AccountHome' });
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);
  return null;
}

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
      return <SplashScreen />;
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
      try {
        const [, result] = await Promise.all([waitBootTimeout(), runLaunchFlow()]);
        if (cancelled) return;
        setPhase(result.phase);
      } catch {
        if (cancelled) return;
        useAuthStore.getState().setUnauthenticated();
        setPhase('auth');
      } finally {
        if (!cancelled) {
          if (!useAuthStore.getState().authResolved) {
            useAuthStore.getState().setUnauthenticated();
          }
          setBootDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setPhase]);

  useEffect(() => {
    if (!bootDone || !authResolved) return;
    if (phase === 'auth') resetRoot('Auth');
    else if (phase === 'onboarding') resetRoot('Onboarding');
    else if (phase === 'main') resetRoot('Main');
  }, [bootDone, authResolved, phase]);

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

  const navPhase = phase === 'boot' ? 'auth' : phase;
  const forceShellGate = process.env.EXPO_PUBLIC_FORCE_SHELL_GATE;
  const blockShellGate =
    shellGate !== 'none' &&
    shellGate !== 'restricted' &&
    !(shellGate === 'offline' && navPhase === 'main' && !forceShellGate) &&
    !(shellGate === 'offline' && navPhase === 'auth' && !forceShellGate);

  if (blockShellGate) {
    return <ShellGateOverlay />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking as LinkingOptions<RootStackParamList>}
      theme={exchangeNavigationTheme}
    >
      <CertAccountOpener />
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={
          navPhase === 'auth' ? 'Auth' : navPhase === 'onboarding' ? 'Onboarding' : 'Main'
        }
      >
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen
          name="Account"
          component={AccountStackNavigator}
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      </Stack.Navigator>
      {shellGate === 'restricted' ? <AccountRestrictedScreen /> : null}
    </NavigationContainer>
  );
}

export { navigationRef } from './navigationRef';
