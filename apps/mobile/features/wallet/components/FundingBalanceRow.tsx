import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme, hsl } from '@shared/theme';
import { formatUsd, formatCryptoAmount, maskBalance } from '@core/domain/wallet/portfolio';
import type { AssetBalance } from '@exchange/mobile-types';

type Props = {
  balance: AssetBalance;
  showBalances: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
};

function FundingBalanceRowInner({
  balance,
  showBalances,
  onDeposit,
  onWithdraw,
  onTransfer,
}: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const maskNum = (v: string) => mask(formatCryptoAmount(v));
  const locked = parseFloat(balance.locked_balance) || 0;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: hsl(theme.colors.borderDefault),
          borderRadius: theme.radius.lg,
          padding: theme.spacing[3],
          marginBottom: theme.spacing[2],
        },
      ]}
    >
      <View style={[styles.mainRow, { gap: theme.spacing[2] }]}>
        <View style={styles.left}>
          <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansBold, color: hsl(theme.colors.foregroundPrimary) }]}>
            {balance.symbol}
          </Text>
          <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary) }]}>{balance.name}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansSemiBold, color: hsl(theme.colors.foregroundPrimary) }]}>
            ${mask(formatUsd(balance.usd_value))}
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Total {maskNum(balance.total_balance)}
          </Text>
        </View>
      </View>
      <View style={[styles.metaRow, { marginTop: theme.spacing[2] }]}>
        <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
          Avail {maskNum(balance.available_balance)}
        </Text>
        <Text
          style={[
            theme.typography.labelSm,
            {
              color: locked > 0 ? hsl(theme.colors.statusWarning) : hsl(theme.colors.foregroundSecondary),
            },
          ]}
        >
          In use {maskNum(balance.locked_balance)}
        </Text>
      </View>
      <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[2] }]}>
        <Pressable
          onPress={onDeposit}
          style={[styles.actionBtn, { borderColor: hsl(theme.colors.borderDefault), borderWidth: StyleSheet.hairlineWidth }]}
        >
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary), fontFamily: theme.fonts.sansSemiBold }]}>
            Deposit
          </Text>
        </Pressable>
        <Pressable
          onPress={onWithdraw}
          style={[styles.actionBtn, { borderColor: hsl(theme.colors.borderDefault), borderWidth: StyleSheet.hairlineWidth }]}
        >
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary), fontFamily: theme.fonts.sansSemiBold }]}>
            Withdraw
          </Text>
        </Pressable>
        <Pressable
          onPress={onTransfer}
          style={[styles.actionBtn, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}
        >
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansBold }]}>
            Transfer
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const FundingBalanceRow = memo(FundingBalanceRowInner);

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row' },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
});
