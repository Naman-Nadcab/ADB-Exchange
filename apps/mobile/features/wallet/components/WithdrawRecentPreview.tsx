import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, EmptyState, SkeletonList } from '@shared/ui';
import type { WithdrawalRecord } from '@exchange/mobile-types';
import { withdrawalStatusLabel } from '@core/domain/wallet/withdraw';
import { truncateHash } from '@core/domain/wallet/deposit';
import { formatTxDate } from '@core/domain/wallet/transactions';

type Props = {
  items: WithdrawalRecord[];
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onViewAll?: () => void;
  onSelect?: (id: string) => void;
};

export function WithdrawRecentPreview({ items, isLoading, error, onRetry, onViewAll, onSelect }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Recent Withdrawals</Text>
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
        <EmptyState title="Could not load withdrawals" message="Tap retry to refresh." />
      ) : items.length === 0 ? (
        <EmptyState title="No withdrawals yet" message="Your withdrawal history will appear here." />
      ) : (
        items.slice(0, 6).map((w, idx) => {
          const amt = w.quantity ?? w.amount ?? '0';
          const tx = w.tx_hash ?? w.txid;
          const status = withdrawalStatusLabel(w.displayStatus ?? w.status);
          const chip = statusChip(w.status, theme);
          return (
            <Pressable
              key={w.id}
              onPress={() => onSelect?.(w.id)}
              style={[
                styles.row,
                idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                  -{amt} {w.asset ?? w.symbol}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                  {w.chain_name ?? w.chain ?? 'Network'}
                  {w.date_time || w.createdAt ? ` · ${formatTxDate(String(w.date_time ?? w.createdAt))}` : ''}
                </Text>
                {tx ? (
                  <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, marginTop: 2 }}>
                    Tx {truncateHash(tx)}
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
      {error && onRetry ? (
        <Pressable onPress={onRetry} style={{ padding: 12 }}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, textAlign: 'center', fontWeight: '600' }}>Retry</Text>
        </Pressable>
      ) : null}
    </ExchangeCard>
  );
}

function statusChip(status: string, theme: ReturnType<typeof useTheme>['theme']) {
  const s = status.toLowerCase();
  if (s === 'completed') return { bg: `hsl(${theme.colors.tradeBuy} / 0.12)`, fg: `hsl(${theme.colors.tradeBuy})` };
  if (s.includes('pending') || s === 'processing') {
    return { bg: `hsl(${theme.colors.statusWarning} / 0.12)`, fg: `hsl(${theme.colors.statusWarning})` };
  }
  if (s === 'failed' || s === 'cancelled') {
    return { bg: `hsl(${theme.colors.tradeSell} / 0.12)`, fg: `hsl(${theme.colors.tradeSell})` };
  }
  return { bg: `hsl(${theme.colors.surfaceMuted})`, fg: `hsl(${theme.colors.foregroundSecondary})` };
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 15, fontWeight: '700' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
