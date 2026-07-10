import { Text, StyleSheet } from 'react-native';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { checkNetworkOnce } from '@core/offline/netInfo';

export function OfflineGateScreen() {
  const { theme } = useTheme();
  const setOnline = useAppStore((s) => s.setOnline);
  const setShellGate = useAppStore((s) => s.setShellGate);

  const retry = () => {
    void checkNetworkOnce().then((state) => {
      setOnline(state.isConnected);
      if (state.isConnected) setShellGate('none');
    });
  };

  return (
    <ScreenLayout testID="S-003">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Offline</Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Check your connection and try again.
      </Text>
      <PrimaryButton title="Retry" onPress={retry} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 24 },
});
