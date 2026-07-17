import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme, hsl } from '@shared/theme';
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
      <View style={[styles.mainRow, { gap: theme.spacing[2], marginBottom: theme.spacing[2.5] }]}>
        <View style={styles.left}>
          <Text
            style={[
              theme.typography.bodyMd,
              { fontFamily: theme.fonts.sansBold, color: hsl(theme.colors.foregroundPrimary) },
            ]}
          >
            {balance.symbol}
          </Text>
          <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            {balance.name ?? balance.symbol}
          </Text>
        </View>
        <Pressable
          onPress={onTrade}
          style={[
            styles.tradeBtn,
            {
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
              borderRadius: theme.radius.md,
              minHeight: theme.sizes.buttonSm,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodySm,
              { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            Trade
          </Text>
        </Pressable>
      </View>
      <View style={[styles.grid, { gap: theme.spacing[2] }]}>
        <View style={[styles.cell, { gap: theme.spacing[0.5] }]}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              },
            ]}
          >
            Total
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {maskNum(total)}
          </Text>
        </View>
        <View style={[styles.cell, { gap: theme.spacing[0.5] }]}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              },
            ]}
          >
            Available
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {maskNum(available)}
          </Text>
        </View>
        <View style={[styles.cell, { gap: theme.spacing[0.5] }]}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              },
            ]}
          >
            In Orders
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {maskNum(locked)}
          </Text>
        </View>
        <View style={[styles.cell, { gap: theme.spacing[0.5] }]}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              },
            ]}
          >
            USD Value
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            ${mask(formatUsd(usd))}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const TradingBalanceRow = memo(TradingBalanceRowInner);

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  left: { flex: 1 },
  tradeBtn: { justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '47%' },
});
