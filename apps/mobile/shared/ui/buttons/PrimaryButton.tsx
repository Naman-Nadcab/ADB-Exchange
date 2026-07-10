import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  testID?: string;
};

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  testID,
}: Props) {
  const { theme } = useTheme();
  const isPrimary = variant === 'primary';
  const bg = isPrimary
    ? `hsl(${theme.colors.brandPrimary})`
    : `hsl(${theme.colors.surfaceMuted})`;
  const fg = isPrimary
    ? `hsl(${theme.colors.brandPrimaryForeground})`
    : `hsl(${theme.colors.foregroundPrimary})`;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.text, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  text: { fontSize: 16, fontWeight: '600' },
});
