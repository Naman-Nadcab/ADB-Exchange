import { View, Text, StyleSheet } from 'react-native';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { P2PDispute } from '@exchange/mobile-types';
import { buildDisputeHistoryEntries } from '@core/domain/p2p/dispute';

type Props = { dispute: P2PDispute };

export function DisputeHistoryList({ dispute }: Props) {
  const { theme } = useTheme();
  const entries = buildDisputeHistoryEntries(dispute);
  if (!entries.length) return null;

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden', marginTop: theme.spacing[3] }}>
      <Text
        style={[
          theme.typography.bodySm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[3],
            paddingBottom: theme.spacing[2],
          },
        ]}
      >
        History
      </Text>
      {entries.map((entry, i) => (
        <View
          key={`${entry.label}-${entry.at}`}
          style={[
            styles.row,
            {
              paddingHorizontal: theme.spacing[4],
              paddingVertical: theme.spacing[2.5],
              borderBottomColor: `hsl(${theme.colors.borderDefault})`,
            },
            i < entries.length - 1 ? styles.rowBorder : null,
          ]}
        >
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{entry.label}</Text>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            {new Date(entry.at).toLocaleString()}
          </Text>
        </View>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
});
