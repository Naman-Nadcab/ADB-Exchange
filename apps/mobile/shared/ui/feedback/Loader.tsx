import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = { size?: 'sm' | 'md' | 'lg'; testID?: string };

export function Loader({ size = 'md', testID }: Props) {
  const { theme } = useTheme();
  const dim = size === 'sm' ? 20 : size === 'lg' ? 40 : 28;
  return (
    <View testID={testID} style={styles.center}>
      <ActivityIndicator size={dim} color={`hsl(${theme.colors.brandPrimary})`} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
});
