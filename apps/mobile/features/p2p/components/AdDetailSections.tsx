import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import {
  parseAdPayments,
  paymentMethodChipTone,
} from '@core/domain/p2p/marketplace';

type Props = {
  payments: ReturnType<typeof parseAdPayments>;
};

function chipColors(tone: ReturnType<typeof paymentMethodChipTone>) {
  if (tone === 'bank') return { bg: 'rgba(14, 203, 129, 0.08)', text: '#0ecb81', border: 'rgba(14, 203, 129, 0.15)' };
  if (tone === 'upi') return { bg: 'rgba(245, 158, 11, 0.08)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.15)' };
  if (tone === 'imps') return { bg: 'rgba(59, 130, 246, 0.08)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.15)' };
  return { bg: 'rgba(128,128,128,0.12)', text: '#888', border: 'rgba(128,128,128,0.2)' };
}

export function AdDetailPaymentMethods({ payments }: Props) {
  const { theme } = useTheme();
  if (!payments.length) {
    return (
      <TerminalPanel style={styles.panel}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>No payment methods listed.</Text>
      </TerminalPanel>
    );
  }

  return (
    <View style={styles.chips}>
      {payments.map((p, i) => {
        const c = chipColors(paymentMethodChipTone(p));
        return (
          <View key={`${p}-${i}`} style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{p}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AdDetailEscrowBanner() {
  const { theme } = useTheme();
  return (
    <View style={[styles.escrow, { backgroundColor: 'rgba(14, 203, 129, 0.08)', borderColor: 'rgba(14, 203, 129, 0.2)' }]}>
      <Ionicons name="shield-checkmark" size={18} color="#0ecb81" />
      <Text style={{ flex: 1, fontSize: 13, color: `hsl(${theme.colors.foregroundPrimary})` }}>
        Funds are secured in escrow until payment is confirmed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  escrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
});
