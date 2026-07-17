import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@shared/theme';

export type ExchangeCardVariant = 'default' | 'marketing' | 'terminal';

export type ExchangeCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ExchangeCardVariant;
  elevated?: boolean;
  padded?: boolean;
  testID?: string;
};

export function ExchangeCard({
  children,
  style,
  variant = 'default',
  elevated,
  padded = true,
  testID,
}: ExchangeCardProps) {
  const { theme } = useTheme();
  const isMarketing = variant === 'marketing';
  const isTerminal = variant === 'terminal';
  const { marketing: m } = theme;

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderRadius: isMarketing ? theme.radius.xl : theme.radius.lg,
          padding: padded ? (isMarketing ? theme.spacing.cardPad : theme.spacing.cardPad) : 0,
          borderColor: isMarketing ? m.goldBorder : `hsl(${theme.colors.borderDefault})`,
          backgroundColor: isMarketing
            ? m.cardBg
            : isTerminal
              ? `hsl(${theme.colors.backgroundPanel})`
              : `hsl(${theme.colors.backgroundElevated})`,
        },
        isMarketing && theme.shadows.sm,
        elevated ? theme.shadows.md : null,
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
