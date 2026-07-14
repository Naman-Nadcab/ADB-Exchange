import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { Skeleton } from './Skeleton';

type Props = { rows?: number };

export function SkeletonList({ rows = 8 }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { gap: theme.spacing[2] }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={56} style={{ borderRadius: theme.radius.md }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
});
