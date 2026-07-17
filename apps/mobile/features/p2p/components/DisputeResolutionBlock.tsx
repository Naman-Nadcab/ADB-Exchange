import { View, Text, StyleSheet } from 'react-native';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { P2PDispute } from '@exchange/mobile-types';
import { disputeResolutionLabel } from '@core/domain/p2p/dispute';

type Props = { dispute: P2PDispute };

export function DisputeResolutionBlock({ dispute }: Props) {
  const { theme } = useTheme();
  if (!dispute.resolution) return null;

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden', marginTop: theme.spacing[3] }}>
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3],
          },
        ]}
      >
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Resolution</Text>
        <Text
          style={[
            theme.typography.bodyMd,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          {disputeResolutionLabel(dispute.resolution)}
        </Text>
      </View>
      {dispute.resolved_at ? (
        <Text
          style={[
            theme.typography.bodySm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              paddingHorizontal: theme.spacing[4],
              paddingBottom: theme.spacing[3],
            },
          ]}
        >
          {new Date(dispute.resolved_at).toLocaleString()}
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
