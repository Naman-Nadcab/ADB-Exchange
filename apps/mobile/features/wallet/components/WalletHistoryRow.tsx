import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { formatTxDate } from '@core/domain/wallet/transactions';
import {
  formatWalletHistoryAmount,
  truncateWalletHistoryValue,
  type WalletHistoryRow as WalletHistoryRowModel,
} from '@core/domain/wallet/walletHistory';
import { WalletHistoryStatusChip } from './WalletHistoryStatusChip';

type Props = {
  row: WalletHistoryRowModel;
  onPress?: () => void;
};

function rowIcon(kind: WalletHistoryRowModel['kind']): keyof typeof Ionicons.glyphMap {
  if (kind === 'deposit') return 'arrow-down-circle';
  if (kind === 'withdraw') return 'arrow-up-circle';
  if (kind === 'transfer') return 'swap-horizontal';
  if (kind === 'convert') return 'repeat';
  return 'receipt';
}

export function WalletHistoryRow({ row, onPress }: Props) {
  const { theme } = useTheme();
  const buy = semanticStatusPalette(theme.colors, 'buy');
  const sell = semanticStatusPalette(theme.colors, 'sell');
  const muted = semanticStatusPalette(theme.colors, 'muted');
  const isIn = row.direction === 'in';
  const isOut = row.direction === 'out';
  const iconColor = isIn ? buy.fg : isOut ? sell.fg : muted.fg;
  const iconBg = isIn ? buy.bg : isOut ? sell.bg : muted.bg;
  const valueColor = isIn ? buy.fg : isOut ? sell.fg : hsl(theme.colors.foregroundPrimary);

  const content = (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: hsl(theme.colors.borderDefault),
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
          gap: theme.spacing[2],
          minHeight: theme.listDensity.asset.rowHeight + 8,
        },
      ]}
    >
      <View style={[styles.left, { gap: theme.spacing[2.5] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: iconBg,
              width: theme.sizes.buttonMd,
              height: theme.sizes.buttonMd,
              borderRadius: theme.radius.md + 2,
            },
          ]}
        >
          <Ionicons name={rowIcon(row.kind)} size={theme.sizes.iconSm - 2} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: hsl(theme.colors.foregroundPrimary),
                fontFamily: theme.fonts.sansBold,
                textTransform: 'capitalize',
              },
            ]}
          >
            {row.typeLabel}
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            {row.symbol}
            {row.network ? ` · ${truncateWalletHistoryValue(row.network, 24)}` : ''}
          </Text>
          <Text
            style={[
              theme.typography.labelSm,
              { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[0.5] },
            ]}
          >
            {formatTxDate(row.createdAt)}
            {row.account ? ` · ${truncateWalletHistoryValue(row.account, 20)}` : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.right, { gap: theme.spacing[1] }]}>
        <Text
          style={[
            theme.typography.bodyMd,
            {
              color: valueColor,
              fontFamily: theme.fonts.sansBold,
              fontVariant: ['tabular-nums'],
              textAlign: 'right',
            },
          ]}
        >
          {formatWalletHistoryAmount(row)}
          {row.kind !== 'convert' ? (
            <Text
              style={[
                theme.typography.labelSm,
                { fontFamily: theme.fonts.sansSemiBold, color: hsl(theme.colors.foregroundSecondary) },
              ]}
            >
              {' '}
              {row.symbol.includes('→') ? '' : row.symbol}
            </Text>
          ) : null}
        </Text>
        {row.fee ? (
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Fee {row.fee}
          </Text>
        ) : null}
        <WalletHistoryStatusChip
          label={row.statusLabel}
          status={row.status}
          confirmations={row.confirmations}
          requiredConfirmations={row.requiredConfirmations}
        />
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={theme.sizes.iconXs} color={hsl(theme.colors.foregroundSecondary)} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right: { alignItems: 'flex-end', maxWidth: '38%' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
});
