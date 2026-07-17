import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { listDensity } from '@shared/theme/listDensity';
import { Skeleton } from './Skeleton';

type Props = { rows?: number; density?: keyof typeof listDensity };

export function SkeletonList({ rows = 8, density = 'default' }: Props) {
  const { theme } = useTheme();
  const { rowHeight, gap } = theme.listDensity[density];

  return (
    <View style={[styles.wrap, { gap }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={rowHeight} style={{ borderRadius: theme.radius.md }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
});
