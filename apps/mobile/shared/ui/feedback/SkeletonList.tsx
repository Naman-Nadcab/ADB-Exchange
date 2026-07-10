import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = { rows?: number };

export function SkeletonList({ rows = 8 }: Props) {
  const { theme } = useTheme();
  const bg = `hsl(${theme.colors.surfaceMuted})`;
  return (
    <View style={styles.wrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, { backgroundColor: bg }]} accessibilityLabel="Loading" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { height: 56, borderRadius: 8, opacity: 0.6 },
});
