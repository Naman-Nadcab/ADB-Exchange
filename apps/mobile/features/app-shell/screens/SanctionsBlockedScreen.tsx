import { Text, StyleSheet } from 'react-native';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';

export function SanctionsBlockedScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-004">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Access Restricted
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        METHErium is not available in your region due to compliance requirements.
      </Text>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14 },
});
