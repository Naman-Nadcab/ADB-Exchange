import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';

export function SplashScreen() {
  const { theme } = useTheme();
  return (
    <ScreenLayout testID="S-000">
      <View style={styles.center}>
        <Text style={[styles.logo, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          METHErium
        </Text>
        <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} style={styles.spinner} />
        <Text style={[styles.id, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>S-000</Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 28, fontWeight: '700' },
  spinner: { marginTop: 24 },
  id: { marginTop: 12, fontSize: 12 },
});
