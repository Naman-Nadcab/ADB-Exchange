import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { P2PDispute } from '@exchange/mobile-types';
import { disputeResolutionLabel } from '@core/domain/p2p/dispute';

type Props = { dispute: P2PDispute };

export function DisputeResolutionBlock({ dispute }: Props) {
  const { theme } = useTheme();
  if (!dispute.resolution) return null;

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={styles.row}>
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>Resolution</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: undefined, color: `hsl(${theme.colors.foregroundPrimary})` }}>
          {disputeResolutionLabel(dispute.resolution)}
        </Text>
      </View>
      {dispute.resolved_at ? (
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, paddingHorizontal: 16, paddingBottom: 12 }}>
          {new Date(dispute.resolved_at).toLocaleString()}
        </Text>
      ) : null}
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
    paddingVertical: 12,
  },
});
