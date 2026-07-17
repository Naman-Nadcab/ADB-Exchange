import { Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { normalizeDisputeEvidence } from '@core/domain/p2p/dispute';

type Props = { evidence: unknown };

export function DisputeEvidenceList({ evidence }: Props) {
  const { theme } = useTheme();
  const urls = normalizeDisputeEvidence(evidence);
  if (!urls.length) return null;

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden', marginTop: theme.spacing[3] }}>
      <Text
        style={[
          theme.typography.bodySm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            marginBottom: theme.spacing[2],
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[3],
          },
        ]}
      >
        Evidence
      </Text>
      {urls.map((url, i) => (
        <Pressable
          key={`${url}-${i}`}
          onPress={() => void Linking.openURL(url)}
          style={[
            styles.row,
            {
              gap: theme.spacing[2],
              paddingHorizontal: theme.spacing[4],
              paddingVertical: theme.spacing[2.5],
              borderBottomColor: `hsl(${theme.colors.borderDefault})`,
            },
            i < urls.length - 1 ? styles.rowBorder : null,
          ]}
        >
          <Ionicons name="open-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text
            style={[
              theme.typography.bodySm,
              { flex: 1, color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium },
            ]}
            numberOfLines={2}
          >
            {url}
          </Text>
        </Pressable>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
});
