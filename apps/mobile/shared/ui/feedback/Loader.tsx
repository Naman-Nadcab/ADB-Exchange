import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = { size?: 'sm' | 'md' | 'lg'; testID?: string };

export function Loader({ size = 'md', testID }: Props) {
  const { theme } = useTheme();
  const dim =
    size === 'sm' ? theme.sizes.iconSm : size === 'lg' ? theme.sizes.iconLg : theme.sizes.iconMd;
  return (
    <View testID={testID} style={[styles.center, { padding: theme.spacing[4] }]}>
      <ActivityIndicator size={dim >= 32 ? 'large' : 'small'} color={`hsl(${theme.colors.brandPrimary})`} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
