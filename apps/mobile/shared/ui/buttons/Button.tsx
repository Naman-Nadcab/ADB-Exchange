import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type React from 'react';
import { useTheme, hapticLight, hapticMedium } from '@shared/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'buy'
  | 'sell'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  testID,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const palette = getVariantColors(variant, c);
  const height =
    size === 'sm'
      ? theme.sizes.buttonSm
      : size === 'md'
        ? theme.sizes.buttonMd
        : size === 'xl'
          ? theme.sizes.buttonXl
          : theme.sizes.inputHeight;
  const labelStyle =
    size === 'sm' ? theme.typography.bodySm : size === 'xl' ? theme.typography.bodyLg : theme.typography.bodyMd;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={(e) => {
        void (variant === 'destructive' || variant === 'sell' ? hapticMedium() : hapticLight());
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: Math.max(height, theme.sizes.tapTarget),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.borderWidth,
          opacity: disabled ? theme.opacity.disabled : pressed ? theme.opacity.pressed : 1,
          borderRadius: theme.radius.lg,
          width: fullWidth ? '100%' : undefined,
          paddingHorizontal: theme.spacing[4],
        },
        variant === 'link' && styles.link,
        theme.shadows[variant === 'primary' || variant === 'buy' || variant === 'sell' ? 'sm' : 'none'],
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          style={[
            styles.label,
            labelStyle,
            {
              color: palette.fg,
              fontFamily: theme.fonts.sansSemiBold,
              letterSpacing: 0.2,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function getVariantColors(
  variant: ButtonVariant,
  c: ReturnType<typeof useTheme>['theme']['colors'],
) {
  switch (variant) {
    case 'secondary':
      return { bg: `hsl(${c.surfaceMuted})`, fg: `hsl(${c.foregroundPrimary})`, border: 'transparent', borderWidth: 0 };
    case 'outline':
      return { bg: 'transparent', fg: `hsl(${c.foregroundPrimary})`, border: `hsl(${c.borderDefault})`, borderWidth: 1 };
    case 'ghost':
      return { bg: 'transparent', fg: `hsl(${c.foregroundPrimary})`, border: 'transparent', borderWidth: 0 };
    case 'destructive':
      return { bg: `hsl(${c.destructive})`, fg: `hsl(${c.destructiveForeground})`, border: 'transparent', borderWidth: 0 };
    case 'buy':
      return { bg: `hsl(${c.tradeBuy})`, fg: `hsl(${c.foregroundInverse})`, border: 'transparent', borderWidth: 0 };
    case 'sell':
      return { bg: `hsl(${c.tradeSell})`, fg: `hsl(${c.foregroundInverse})`, border: 'transparent', borderWidth: 0 };
    case 'link':
      return { bg: 'transparent', fg: `hsl(${c.brandPrimary})`, border: 'transparent', borderWidth: 0 };
    default:
      return { bg: `hsl(${c.brandPrimary})`, fg: `hsl(${c.brandPrimaryForeground})`, border: 'transparent', borderWidth: 0 };
  }
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  link: { minHeight: undefined, paddingVertical: 4 },
});

/** Back-compat alias — prefer Button */
export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? 'primary'} />;
}

export function SecondaryButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}
