import { Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, onRetry }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onRetry}
      style={[styles.box, { backgroundColor: `hsl(${theme.colors.statusError} / 0.12)` }]}
    >
      <Text style={[styles.text, { color: `hsl(${theme.colors.statusError})` }]}>{message}</Text>
      {onRetry ? (
        <Text style={[styles.retry, { color: `hsl(${theme.colors.statusError})` }]}>Tap to retry</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { padding: 12, borderRadius: 8, marginBottom: 12 },
  text: { fontSize: 14 },
  retry: { fontSize: 12, marginTop: 4, fontWeight: '600' },
});
