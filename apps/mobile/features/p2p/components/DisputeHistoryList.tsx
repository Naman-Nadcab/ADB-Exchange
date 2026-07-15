import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { P2PDispute } from '@exchange/mobile-types';
import { buildDisputeHistoryEntries } from '@core/domain/p2p/dispute';

type Props = { dispute: P2PDispute };

export function DisputeHistoryList({ dispute }: Props) {
  const { theme } = useTheme();
  const entries = buildDisputeHistoryEntries(dispute);
  if (!entries.length) return null;

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        History
      </Text>
      {entries.map((entry, i) => (
        <View key={`${entry.label}-${entry.at}`} style={[styles.row, i < entries.length - 1 ? styles.rowBorder : null]}>
          <Text style={{ fontSize: 14, color: `hsl(${theme.colors.foregroundPrimary})` }}>{entry.label}</Text>
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>
            {new Date(entry.at).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
