import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { normalizeDisputeEvidence } from '@core/domain/p2p/dispute';

type Props = { evidence: unknown };

export function DisputeEvidenceList({ evidence }: Props) {
  const { theme } = useTheme();
  const urls = normalizeDisputeEvidence(evidence);
  if (!urls.length) return null;

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        Evidence
      </Text>
      {urls.map((url, i) => (
        <Pressable
          key={`${url}-${i}`}
          onPress={() => void Linking.openURL(url)}
          style={[styles.row, i < urls.length - 1 ? styles.rowBorder : null]}
        >
          <Ionicons name="open-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ flex: 1, fontSize: 13, color: `hsl(${theme.colors.brandPrimary})` }} numberOfLines={2}>
            {url}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
