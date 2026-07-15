import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
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
    <View style={[styles.wrap, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {balance.symbol}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {balance.name}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            ${mask(formatUsd(balance.usd_value))}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            Total {maskNum(balance.total_balance)}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
          Avail {maskNum(balance.available_balance)}
        </Text>
        <Text
          style={{
            color: locked > 0 ? '#f59e0b' : `hsl(${theme.colors.foregroundSecondary})`,
            fontSize: 11,
          }}
        >
          In use {maskNum(balance.locked_balance)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onDeposit} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, borderWidth: StyleSheet.hairlineWidth }]}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600' }}>Deposit</Text>
        </Pressable>
        <Pressable onPress={onWithdraw} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, borderWidth: StyleSheet.hairlineWidth }]}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600' }}>Withdraw</Text>
        </Pressable>
        <Pressable onPress={onTransfer} style={[styles.actionBtn, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '700' }}>Transfer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const FundingBalanceRow = memo(FundingBalanceRowInner);

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 10 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minHeight: 32, justifyContent: 'center' },
});
