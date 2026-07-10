import { Text, StyleSheet } from 'react-native';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';

export function AccountRestrictedScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-005">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Account Restricted
      </Text>
      <Text style={[styles.body, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Your account has limited access. Contact support for assistance.
      </Text>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14 },
});
