import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@shared/theme';
import { marketing } from '@shared/theme/marketing';

type Variant = 'default' | 'marketing' | 'terminal';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: Variant;
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
}: Props) {
  const { theme } = useTheme();
  const isMarketing = variant === 'marketing';
  const isTerminal = variant === 'terminal';

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderRadius: isMarketing ? 16 : theme.radius.lg,
          padding: padded ? (isMarketing ? 16 : theme.spacing.cardPad) : 0,
          borderColor: isMarketing
            ? marketing.goldBorder
            : `hsl(${theme.colors.borderDefault})`,
          backgroundColor: isMarketing
            ? marketing.cardBg
            : isTerminal
              ? `hsl(${theme.colors.backgroundPanel})`
              : `hsl(${theme.colors.backgroundElevated})`,
        },
        isMarketing && styles.marketingInset,
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
  marketingInset: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});
