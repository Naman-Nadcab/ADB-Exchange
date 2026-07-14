import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  subtle?: boolean;
  padded?: boolean;
  testID?: string;
};

/** Mobile adaptation of frontend `.terminal-panel` */
export function TerminalPanel({ children, style, subtle, padded = true, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: subtle
            ? `hsl(${theme.colors.surfaceMuted})`
            : `hsl(${theme.colors.backgroundElevated})`,
          padding: padded ? theme.spacing.cardPad : 0,
        },
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
