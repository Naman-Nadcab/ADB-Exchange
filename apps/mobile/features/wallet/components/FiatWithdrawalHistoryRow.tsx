import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, StatusChip } from '@shared/ui';
import type { FiatWithdrawal } from '@exchange/mobile-types';
import {
  bankLabelFromSnapshot,
  canCancelFiatWithdrawal,
  fiatWithdrawalStatusTone,
  fiatWithdrawalTimestamp,
  formatInr,
} from '@core/domain/wallet/fiat';

type Props = {
  item: FiatWithdrawal;
  onPress?: () => void;
  onCancel?: () => void;
  cancelPending?: boolean;
};

export function FiatWithdrawalHistoryRow({ item, onPress, onCancel, cancelPending }: Props) {
  const { theme } = useTheme();
  const tone = fiatWithdrawalStatusTone(item.status);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ExchangeCard variant="terminal" style={styles.row}>
        <View style={styles.top}>
          <Text style={[styles.amount, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{formatInr(item.amount)}</Text>
          <StatusChip label={item.status} tone={tone} />
        </View>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 4 }}>
          {bankLabelFromSnapshot(item.bank_snapshot)} · {fiatWithdrawalTimestamp(item)}
        </Text>
        {item.failure_reason ? (
          <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 11, marginTop: 4 }}>
            Reason: {item.failure_reason}
          </Text>
        ) : null}
        {canCancelFiatWithdrawal(item.status) && onCancel ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onCancel();
            }}
            disabled={cancelPending}
            style={[styles.cancelBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, opacity: cancelPending ? 0.5 : 1 }]}
          >
            <Ionicons name="close" size={14} color={`hsl(${theme.colors.foregroundSecondary})`} />
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, fontWeight: '600' }}>
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </ExchangeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 8, padding: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  amount: { fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
