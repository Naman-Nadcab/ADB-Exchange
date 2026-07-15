import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Props = { notes: string };

export function DisputeAdminNotes({ notes }: Props) {
  const { theme } = useTheme();
  if (!notes.trim()) return null;

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#f59e0b" />
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>Admin Response</Text>
      </View>
      <Text style={{ fontSize: 14, color: `hsl(${theme.colors.foregroundPrimary})`, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 12 }}>
        {notes}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
});
