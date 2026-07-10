import { Text, StyleSheet } from 'react-native';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';

export function RateLimitedScreen() {
  const { theme } = useTheme();
  const setShellGate = useAppStore((s) => s.setShellGate);

  return (
    <ScreenLayout testID="S-007">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Rate Limited
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Too many requests. Please wait and try again.
      </Text>
      <PrimaryButton title="OK" onPress={() => setShellGate('none')} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 24 },
});
