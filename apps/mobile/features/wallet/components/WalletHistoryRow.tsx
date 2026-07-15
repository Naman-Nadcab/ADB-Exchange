import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
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
  const isIn = row.direction === 'in';
  const isOut = row.direction === 'out';
  const iconColor = isIn
    ? `hsl(${theme.colors.tradeBuy})`
    : isOut
      ? `hsl(${theme.colors.tradeSell})`
      : `hsl(${theme.colors.foregroundSecondary})`;
  const iconBg = isIn
    ? `hsl(${theme.colors.tradeBuy} / 0.12)`
    : isOut
      ? `hsl(${theme.colors.tradeSell} / 0.12)`
      : `hsl(${theme.colors.surfaceMuted})`;
  const valueColor = isIn
    ? `hsl(${theme.colors.tradeBuy})`
    : isOut
      ? `hsl(${theme.colors.tradeSell})`
      : `hsl(${theme.colors.foregroundPrimary})`;

  const content = (
    <View style={[styles.row, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={rowIcon(row.kind)} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', textTransform: 'capitalize' }}>
            {row.typeLabel}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            {row.symbol}
            {row.network ? ` · ${truncateWalletHistoryValue(row.network, 24)}` : ''}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, marginTop: 2 }}>
            {formatTxDate(row.createdAt)}
            {row.account ? ` · ${truncateWalletHistoryValue(row.account, 20)}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={{ color: valueColor, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right' }}>
          {formatWalletHistoryAmount(row)}
          {row.kind !== 'convert' ? (
            <Text style={{ fontSize: 11, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>
              {' '}
              {row.symbol.includes('→') ? '' : row.symbol}
            </Text>
          ) : null}
        </Text>
        {row.fee ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>Fee {row.fee}</Text>
        ) : null}
        <WalletHistoryStatusChip
          label={row.statusLabel}
          status={row.status}
          confirmations={row.confirmations}
          requiredConfirmations={row.requiredConfirmations}
        />
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  right: { alignItems: 'flex-end', gap: 4, maxWidth: '38%' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
