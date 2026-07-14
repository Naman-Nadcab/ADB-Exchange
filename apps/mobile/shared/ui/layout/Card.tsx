import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padded?: boolean;
  testID?: string;
};

export function Card({ children, style, elevated, padded = true, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          padding: padded ? theme.spacing.cardPad : 0,
        },
        elevated ? theme.shadows.md : theme.shadows.none,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, overflow: 'hidden' },
});
