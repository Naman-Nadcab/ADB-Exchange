import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from './providers/QueryProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { WsProvider } from './providers/WsProvider';
import { ObservabilityProvider } from './providers/ObservabilityProvider';
import { GestureProvider } from './providers/GestureProvider';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { AppProviders } from './providers/AppProviders';
import { RootNavigator } from './navigation/RootNavigator';
import { initStorage } from './bootstrap/initStorage';
import { FontProvider } from './providers/FontProvider';
import { ToastHost } from '@shared/ui';

function AppInner() {
  useEffect(() => {
    void initStorage();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <FontProvider>
        <AppProviders>
          <RootNavigator />
        </AppProviders>
        <ToastHost />
      </FontProvider>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureProvider>
        <SafeAreaProvider>
          <ObservabilityProvider>
            <QueryProvider>
              <ThemeProvider>
                <AuthProvider>
                  <WsProvider>
                    <AppInner />
                  </WsProvider>
                </AuthProvider>
              </ThemeProvider>
            </QueryProvider>
          </ObservabilityProvider>
        </SafeAreaProvider>
      </GestureProvider>
    </ErrorBoundary>
  );
}
