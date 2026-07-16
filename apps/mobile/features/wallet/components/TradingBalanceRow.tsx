import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatUsd, formatCryptoAmount, maskBalance } from '@core/domain/wallet/portfolio';
import type { TradingBalance } from '@exchange/mobile-types';

type Props = {
  balance: TradingBalance;
  showBalances: boolean;
  onTrade: () => void;
};

function TradingBalanceRowInner({ balance, showBalances, onTrade }: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const maskNum = (v: string) => mask(formatCryptoAmount(v));
  const total = balance.equity || balance.wallet_balance || '0';
  const available = balance.available_balance || balance.wallet_balance || '0';
  const locked = balance.locked_balance || '0';
  const usd = balance.usd_value ?? '0';

  return (
    <View style={[styles.wrap, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {balance.symbol}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {balance.name ?? balance.symbol}
          </Text>
        </View>
        <Pressable onPress={onTrade} style={[styles.tradeBtn, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, fontWeight: '700' }}>Trade</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Total</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>
            {maskNum(total)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Available</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>
            {maskNum(available)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>In Orders</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>
            {maskNum(locked)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>USD Value</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>
            ${mask(formatUsd(usd))}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const TradingBalanceRow = memo(TradingBalanceRowInner);

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  left: { flex: 1 },
  tradeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 32, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', gap: 2 },
  cellLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
