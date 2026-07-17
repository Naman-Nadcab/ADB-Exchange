import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';

type Props = { notes: string };

export function DisputeAdminNotes({ notes }: Props) {
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');
  if (!notes.trim()) return null;

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden', marginTop: theme.spacing[3] }}>
      <View
        style={[
          styles.header,
          {
            gap: theme.spacing[1.5],
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[3],
            paddingBottom: theme.spacing[2],
          },
        ]}
      >
        <Ionicons name="shield-checkmark-outline" size={theme.sizes.iconSm} color={warning.fg} />
        <Text style={[theme.typography.bodySm, { color: warning.fg, fontFamily: theme.fonts.sansBold }]}>Admin Response</Text>
      </View>
      <Text
        style={[
          theme.typography.bodyMd,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            paddingHorizontal: theme.spacing[4],
            paddingBottom: theme.spacing[3],
          },
        ]}
      >
        {notes}
      </Text>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
});
