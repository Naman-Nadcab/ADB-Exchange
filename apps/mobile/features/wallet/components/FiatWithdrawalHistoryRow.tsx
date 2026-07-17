import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const tone = fiatWithdrawalStatusTone(item.status);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ExchangeCard
        variant="terminal"
        style={{ marginBottom: theme.spacing[2], padding: theme.spacing[3] }}
      >
        <View style={[styles.top, { gap: theme.spacing[2] }]}>
          <Text
            style={[
              theme.typography.headingSm,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            {formatInr(item.amount)}
          </Text>
          <StatusChip label={item.status} tone={tone} />
        </View>
        <Text
          style={[
            theme.typography.bodySm,
            { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[1] },
          ]}
        >
          {bankLabelFromSnapshot(item.bank_snapshot)} · {fiatWithdrawalTimestamp(item)}
        </Text>
        {item.failure_reason ? (
          <Text
            style={[
              theme.typography.labelSm,
              { color: warning.fg, marginTop: theme.spacing[1] },
            ]}
          >
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
            style={[
              styles.cancelBtn,
              {
                borderColor: hsl(theme.colors.borderDefault),
                marginTop: theme.spacing[2],
                gap: theme.spacing[1],
                paddingHorizontal: theme.spacing[2.5],
                paddingVertical: theme.spacing[1.5],
                borderRadius: theme.radius.md,
                opacity: cancelPending ? theme.opacity.disabled : 1,
              },
            ]}
          >
            <Ionicons name="close" size={theme.sizes.iconXs - 2} color={hsl(theme.colors.foregroundSecondary)} />
            <Text
              style={[
                theme.typography.bodySm,
                { color: hsl(theme.colors.foregroundSecondary), fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </ExchangeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
