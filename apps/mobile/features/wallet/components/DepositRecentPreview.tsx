import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import type { DepositHistoryRecord } from '@exchange/mobile-types';
import { depositStatusLabel, truncateHash } from '@core/domain/wallet/deposit';
import { formatTxDate } from '@core/domain/wallet/transactions';

type Props = {
  items: DepositHistoryRecord[];
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onViewAll?: () => void;
  onSelect?: (txHash: string) => void;
  title?: string;
};

export function DepositRecentPreview({
  items,
  isLoading,
  error,
  onRetry,
  onViewAll,
  onSelect,
  title = 'Recent Deposits',
}: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{title}</Text>
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
        <ErrorState title="Could not load deposits" onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No on-chain deposits yet"
          message="After you send crypto to your deposit address, it appears here automatically (usually within 1–3 minutes)."
        />
      ) : (
        items.slice(0, 6).map((d, idx) => {
          const status = depositStatusLabel(d.status, d.confirmations, d.requiredConfirmations);
          const chip = statusChip(d.status, theme);
          return (
            <Pressable
              key={d.id}
              onPress={d.txHash && onSelect ? () => onSelect(d.txHash!) : undefined}
              style={[
                styles.row,
                idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                  +{d.amount} {d.symbol}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                  {d.chainName ?? 'Network'}
                  {d.createdAt ? ` · ${formatTxDate(d.createdAt)}` : ''}
                </Text>
                {d.txHash ? (
                  <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, marginTop: 2 }}>
                    Tx {truncateHash(d.txHash)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <Text style={{ color: chip.fg, fontSize: 10, fontWeight: '600' }}>{status}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ExchangeCard>
  );
}

function statusChip(status: string, theme: ReturnType<typeof useTheme>['theme']) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'confirmed') {
    return { bg: `hsl(${theme.colors.tradeBuy} / 0.12)`, fg: `hsl(${theme.colors.tradeBuy})` };
  }
  if (s === 'pending' || s === 'confirming') {
    return { bg: `hsl(${theme.colors.statusWarning} / 0.12)`, fg: `hsl(${theme.colors.statusWarning})` };
  }
  if (s === 'failed') {
    return { bg: `hsl(${theme.colors.tradeSell} / 0.12)`, fg: `hsl(${theme.colors.tradeSell})` };
  }
  return { bg: `hsl(${theme.colors.surfaceMuted})`, fg: `hsl(${theme.colors.foregroundSecondary})` };
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
