import { Text, StyleSheet } from 'react-native';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';

export function MaintenanceScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-002">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Maintenance
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        METHErium is temporarily unavailable. Please try again later.
      </Text>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14 },
});
