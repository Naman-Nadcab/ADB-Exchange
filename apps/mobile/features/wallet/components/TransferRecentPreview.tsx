import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, EmptyState, SkeletonList } from '@shared/ui';
import type { TransferHistoryItem } from '@exchange/mobile-types';
import { transferAccountLabel, transferStatusLabel } from '@core/domain/wallet/transfer';
import { formatTxDate } from '@core/domain/wallet/transactions';

type Props = {
  items: TransferHistoryItem[];
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onViewAll?: () => void;
};

export function TransferRecentPreview({ items, isLoading, error, onRetry, onViewAll }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Recent Transfers</Text>
        <View style={styles.actions}>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Refresh</Text>
            </Pressable>
          ) : null}
          {onViewAll ? (
            <Pressable onPress={onViewAll} hitSlop={8} style={styles.viewAll}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>View all</Text>
              <Ionicons name="chevron-forward" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <EmptyState title="History unavailable" message="Transfer history could not be loaded." />
      ) : items.length === 0 ? (
        <EmptyState title="No transfers yet" message="Your internal transfer history will appear here." />
      ) : (
        items.slice(0, 6).map((item, idx) => {
          const chip = statusChip(item.status, theme);
          return (
            <View
              key={item.id}
              style={[
                styles.row,
                idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                  {item.direction === 'sent' ? '-' : '+'}
                  {item.amount} {item.symbol}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                  {transferAccountLabel(item.fromAccount)} → {transferAccountLabel(item.toAccount)}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>
                  {formatTxDate(item.createdAt)}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <Text style={{ color: chip.fg, fontSize: 10, fontWeight: '600' }}>{transferStatusLabel(item.status)}</Text>
              </View>
            </View>
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
  if (s === 'failed') return { bg: `hsl(${theme.colors.tradeSell} / 0.12)`, fg: `hsl(${theme.colors.tradeSell})` };
  return { bg: `hsl(${theme.colors.surfaceMuted})`, fg: `hsl(${theme.colors.foregroundSecondary})` };
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
