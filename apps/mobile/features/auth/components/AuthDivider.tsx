import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

export function AuthDivider({ label = 'or' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { marginVertical: theme.spacing[4], gap: theme.spacing[3] }]}>
      <View style={[styles.line, { backgroundColor: `hsl(${theme.colors.surfaceAccent})` }]} />
      <Text
        style={[
          theme.typography.labelSm,
          { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansMedium },
        ]}
      >
        {label}
      </Text>
      <View style={[styles.line, { backgroundColor: `hsl(${theme.colors.surfaceAccent})` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
