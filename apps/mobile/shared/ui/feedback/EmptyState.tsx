import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { PrimaryButton } from '../buttons/PrimaryButton';

type Props = {
  title: string;
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
};

export function EmptyState({ title, message, onAction, actionLabel }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{title}</Text>
      {message ? (
        <Text style={[styles.msg, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{message}</Text>
      ) : null}
      {onAction && actionLabel ? <PrimaryButton title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  msg: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
});
