import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  screenId: string;
  title: string;
};

/** Sprint 0 placeholder — no business UI. */
export function PlaceholderScreen({ screenId, title }: Props) {
  const { theme } = useTheme();
  const bg = `hsl(${theme.colors.backgroundPrimary})`;
  const fg = `hsl(${theme.colors.foregroundPrimary})`;
  const muted = `hsl(${theme.colors.foregroundSecondary})`;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{title}</Text>
      <Text style={[styles.id, { color: muted }]}>{screenId}</Text>
      <Text style={[styles.note, { color: muted }]}>Sprint 0 foundation placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  id: { fontSize: 12, marginTop: 8 },
  note: { fontSize: 12, marginTop: 16, textAlign: 'center' },
});
