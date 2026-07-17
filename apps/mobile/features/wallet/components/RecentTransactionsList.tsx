import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { ExchangeCard, EmptyState, ErrorState, SkeletonList } from '@shared/ui';
import type { WalletRecentTransaction } from '@exchange/mobile-types';
import { formatTxAmount, formatTxDate } from '@core/domain/wallet/transactions';

type Props = {
  items: WalletRecentTransaction[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewAll?: () => void;
  onSelect?: (item: WalletRecentTransaction) => void;
};

function txIcon(type: WalletRecentTransaction['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'deposit') return 'arrow-down-circle';
  if (type === 'withdrawal') return 'arrow-up-circle';
  return 'swap-horizontal';
}

function statusStyle(status: string, theme: ReturnType<typeof useTheme>['theme']) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'confirmed') {
    const palette = semanticStatusPalette(theme.colors, 'buy');
    return { bg: palette.bg, fg: palette.fg };
  }
  if (s === 'pending') {
    const palette = semanticStatusPalette(theme.colors, 'warning');
    return { bg: palette.bg, fg: palette.fg };
  }
  if (s === 'failed') {
    const palette = semanticStatusPalette(theme.colors, 'sell');
    return { bg: palette.bg, fg: palette.fg };
  }
  const palette = semanticStatusPalette(theme.colors, 'muted');
  return { bg: palette.bg, fg: palette.fg };
}

export function RecentTransactionsList({ items, isLoading, error, onRetry, onViewAll, onSelect }: Props) {
  const { theme } = useTheme();
  const buy = semanticStatusPalette(theme.colors, 'buy');
  const sell = semanticStatusPalette(theme.colors, 'sell');
  const muted = semanticStatusPalette(theme.colors, 'muted');

  return (
    <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[3.5], paddingVertical: 0, paddingHorizontal: 0 }}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: hsl(theme.colors.borderDefault),
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3.5],
          },
        ]}
      >
        <Text
          style={[
            theme.typography.headingSm,
            { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
          ]}
        >
          Recent Activity
        </Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8} style={[styles.viewAll, { gap: theme.spacing[0.5] }]}>
            <Text
              style={[
                theme.typography.bodyMd,
                { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansSemiBold },
              ]}
            >
              View all
            </Text>
            <Ionicons name="chevron-forward" size={theme.sizes.iconXs - 2} color={hsl(theme.colors.brandPrimary)} />
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
          const iconColor = isDeposit ? buy.fg : isWithdraw ? sell.fg : muted.fg;
          const iconBg = isDeposit ? buy.bg : isWithdraw ? sell.bg : muted.bg;
          const valueColor = isDeposit ? buy.fg : isWithdraw ? sell.fg : hsl(theme.colors.foregroundPrimary);

          return (
            <Pressable
              key={tx.id || `${tx.type}-${idx}`}
              onPress={onSelect ? () => onSelect(tx) : undefined}
              style={[
                styles.row,
                {
                  paddingHorizontal: theme.spacing[4],
                  paddingVertical: theme.spacing[3],
                  gap: theme.spacing[2],
                  minHeight: theme.listDensity.asset.rowHeight,
                },
                idx > 0
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hsl(theme.colors.borderDefault) }
                  : null,
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
                  <Ionicons name={txIcon(tx.type)} size={theme.sizes.iconSm - 2} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      {
                        color: hsl(theme.colors.foregroundPrimary),
                        fontFamily: theme.fonts.sansSemiBold,
                        textTransform: 'capitalize',
                      },
                    ]}
                  >
                    {tx.type}
                  </Text>
                  <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
                    {tx.symbol}
                    {tx.created_at ? ` · ${formatTxDate(tx.created_at)}` : ''}
                  </Text>
                </View>
              </View>
              <View style={[styles.right, { gap: theme.spacing[1] }]}>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: valueColor, fontFamily: theme.fonts.sansBold, fontVariant: ['tabular-nums'] },
                  ]}
                >
                  {isDeposit ? '+' : isWithdraw ? '-' : ''}
                  {formatTxAmount(String(Math.abs(amt)))}{' '}
                  <Text
                    style={[
                      theme.typography.labelSm,
                      { fontFamily: theme.fonts.sansSemiBold, color: hsl(theme.colors.foregroundSecondary) },
                    ]}
                  >
                    {tx.symbol}
                  </Text>
                </Text>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: chip.bg,
                      borderRadius: theme.radius.full,
                      paddingHorizontal: theme.spacing[2],
                      paddingVertical: theme.spacing[0.5],
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.labelSm,
                      { color: chip.fg, fontFamily: theme.fonts.sansSemiBold },
                    ]}
                  >
                    {tx.status}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right: { alignItems: 'flex-end' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  chip: {},
});
