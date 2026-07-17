import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@shared/theme';

export type StateFrameVariant = 'empty' | 'error';

type Props = {
  variant?: StateFrameVariant;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Shared presentation shell for EmptyState and ErrorState. */
export function StateFrame({ variant = 'empty', children, style, testID }: Props) {
  const { theme } = useTheme();
  const isError = variant === 'error';

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          padding: theme.spacing[6],
          borderRadius: theme.radius.lg,
          borderColor: isError
            ? `hsl(${theme.colors.statusError} / 0.35)`
            : `hsl(${theme.colors.borderDefault})`,
          backgroundColor: isError
            ? `hsl(${theme.colors.statusError} / 0.08)`
            : `hsl(${theme.colors.surfaceMuted} / 0.35)`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
