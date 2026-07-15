import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, EmptyState, ErrorState, SkeletonList } from '@shared/ui';
import type { WalletRecentTransaction } from '@exchange/mobile-types';
import { formatTxAmount, formatTxDate } from '@core/domain/wallet/transactions';

type Props = {
  items: WalletRecentTransaction[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewAll?: () => void;
};

function txIcon(type: WalletRecentTransaction['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'deposit') return 'arrow-down-circle';
  if (type === 'withdrawal') return 'arrow-up-circle';
  return 'swap-horizontal';
}

function statusStyle(status: string, theme: ReturnType<typeof useTheme>['theme']) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'confirmed') {
    return { bg: `hsl(${theme.colors.tradeBuy} / 0.12)`, fg: `hsl(${theme.colors.tradeBuy})` };
  }
  if (s === 'pending') {
    return { bg: `hsl(${theme.colors.statusWarning} / 0.12)`, fg: `hsl(${theme.colors.statusWarning})` };
  }
  if (s === 'failed') {
    return { bg: `hsl(${theme.colors.tradeSell} / 0.12)`, fg: `hsl(${theme.colors.tradeSell})` };
  }
  return { bg: `hsl(${theme.colors.surfaceMuted})`, fg: `hsl(${theme.colors.foregroundSecondary})` };
}

export function RecentTransactionsList({ items, isLoading, error, onRetry, onViewAll }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Recent Activity</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8} style={styles.viewAll}>
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>View all</Text>
            <Ionicons name="chevron-forward" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState title="Could not load recent activity" message={error} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No recent activity"
          message="Your deposits, withdrawals, and transfers will appear here."
        />
      ) : (
        items.slice(0, 6).map((tx, idx) => {
          const isDeposit = tx.type === 'deposit';
          const isWithdraw = tx.type === 'withdrawal';
          const amt = parseFloat(tx.amount) || 0;
          const chip = statusStyle(tx.status, theme);
          const iconColor = isDeposit
            ? `hsl(${theme.colors.tradeBuy})`
            : isWithdraw
              ? `hsl(${theme.colors.tradeSell})`
              : `hsl(${theme.colors.foregroundSecondary})`;
          const iconBg = isDeposit
            ? `hsl(${theme.colors.tradeBuy} / 0.12)`
            : isWithdraw
              ? `hsl(${theme.colors.tradeSell} / 0.12)`
              : `hsl(${theme.colors.surfaceMuted})`;
          const valueColor = isDeposit
            ? `hsl(${theme.colors.tradeBuy})`
            : isWithdraw
              ? `hsl(${theme.colors.tradeSell})`
              : `hsl(${theme.colors.foregroundPrimary})`;

          return (
            <View
              key={tx.id || `${tx.type}-${idx}`}
              style={[
                styles.row,
                idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
              ]}
            >
              <View style={styles.left}>
                <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                  <Ionicons name={txIcon(tx.type)} size={18} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', textTransform: 'capitalize' }}>
                    {tx.type}
                  </Text>
                  <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                    {tx.symbol}
                    {tx.created_at ? ` · ${formatTxDate(tx.created_at)}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.right}>
                <Text style={{ color: valueColor, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {isDeposit ? '+' : isWithdraw ? '-' : ''}
                  {formatTxAmount(String(Math.abs(amt)))}{' '}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>
                    {tx.symbol}
                  </Text>
                </Text>
                <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                  <Text style={{ color: chip.fg, fontSize: 10, fontWeight: '600' }}>{tx.status}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 15, fontWeight: '700' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
