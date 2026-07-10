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
import { useTheme } from '@shared/theme';

function AppInner() {
  const { colorScheme } = useTheme();

  useEffect(() => {
    void initStorage();
  }, []);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AppProviders>
        <RootNavigator />
      </AppProviders>
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
