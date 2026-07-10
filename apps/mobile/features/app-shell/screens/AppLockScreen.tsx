import { Text, StyleSheet } from 'react-native';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { appLock } from '@core/security/appLock';
import { useAppStore } from '@core/state/appStore';

export function AppLockScreen() {
  const { theme } = useTheme();
  const setShellGate = useAppStore((s) => s.setShellGate);

  const unlock = async () => {
    const ok = await appLock.promptUnlock();
    if (ok) setShellGate('none');
  };

  return (
    <ScreenLayout testID="D-900">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        App Locked
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Authenticate to continue.
      </Text>
      <PrimaryButton title="Unlock" onPress={() => void unlock()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 24 },
});
