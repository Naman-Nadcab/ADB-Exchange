import { Text, StyleSheet, Linking } from 'react-native';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';

export function ForceUpdateScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-001">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Update Required
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        A new version of METHErium is required to continue.
      </Text>
      <PrimaryButton title="Open App Store" onPress={() => Linking.openURL('https://app.metheorium.com')} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 24 },
});
