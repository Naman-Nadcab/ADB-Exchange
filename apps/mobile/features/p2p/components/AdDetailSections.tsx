import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { TerminalPanel } from '@shared/ui';
import { parseAdPayments, paymentMethodChipTone } from '@core/domain/p2p/marketplace';

type Props = {
  payments: ReturnType<typeof parseAdPayments>;
};

function paymentChipPalette(
  colors: ReturnType<typeof useTheme>['theme']['colors'],
  tone: ReturnType<typeof paymentMethodChipTone>,
) {
  if (tone === 'bank') return semanticStatusPalette(colors, 'buy');
  if (tone === 'upi') return semanticStatusPalette(colors, 'warning');
  if (tone === 'imps') return semanticStatusPalette(colors, 'info');
  return semanticStatusPalette(colors, 'muted');
}

export function AdDetailPaymentMethods({ payments }: Props) {
  const { theme } = useTheme();
  if (!payments.length) {
    return (
      <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          No payment methods listed.
        </Text>
      </TerminalPanel>
    );
  }

  return (
    <View style={[styles.chips, { gap: theme.spacing[2], marginBottom: theme.spacing[3] }]}>
      {payments.map((p, i) => {
        const c = paymentChipPalette(theme.colors, paymentMethodChipTone(p));
        return (
          <View
            key={`${p}-${i}`}
            style={[
              styles.chip,
              {
                backgroundColor: c.bg,
                borderColor: c.border,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing[2.5],
                paddingVertical: theme.spacing[1.5],
              },
            ]}
          >
            <Text
              style={[
                theme.typography.bodySm,
                { color: c.fg, fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              {p}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function AdDetailEscrowBanner() {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');

  return (
    <View
      style={[
        styles.escrow,
        {
          backgroundColor: success.bg,
          borderColor: success.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing[3],
          marginBottom: theme.spacing[3],
          gap: theme.spacing[2.5],
        },
      ]}
    >
      <Ionicons name="shield-checkmark" size={theme.sizes.iconMd} color={success.fg} />
      <Text style={[theme.typography.bodySm, { flex: 1, color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Funds are secured in escrow until payment is confirmed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1 },
  escrow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
