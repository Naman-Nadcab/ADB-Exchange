import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { FilterChip, SearchBar, SegmentControl } from '@shared/ui';
import type { WalletHistoryFilters, WalletHistoryTab } from '@core/domain/wallet/walletHistory';
import { WALLET_HISTORY_TABS } from '@core/domain/wallet/walletHistory';

type Props = {
  tab: WalletHistoryTab;
  onTabChange: (tab: WalletHistoryTab) => void;
  filters: WalletHistoryFilters;
  onFiltersChange: (patch: Partial<WalletHistoryFilters>) => void;
  onReset: () => void;
  assetOptions: string[];
};

const STATUS_OPTIONS = ['', 'completed', 'pending', 'processing', 'failed'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All status',
  completed: 'Completed',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
};

const METHOD_OPTIONS = ['all', 'on-chain', 'internal'] as const;
const METHOD_LABELS: Record<(typeof METHOD_OPTIONS)[number], string> = {
  all: 'All methods',
  'on-chain': 'On-chain',
  internal: 'Internal',
};

export function WalletHistoryFiltersBar({
  tab,
  onTabChange,
  filters,
  onFiltersChange,
  onReset,
  assetOptions,
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <SegmentControl
        tabs={WALLET_HISTORY_TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={tab}
        onChange={(id) => onTabChange(id as WalletHistoryTab)}
        testID="wallet-history-tabs"
      />

      <SearchBar
        value={filters.search}
        onChangeText={(search) => onFiltersChange({ search })}
        placeholder="Search asset, txid, address, network"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {assetOptions.map((asset) => (
          <FilterChip
            key={asset || 'all'}
            label={asset || 'All assets'}
            selected={filters.asset === asset}
            onPress={() => onFiltersChange({ asset: filters.asset === asset ? '' : asset })}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_OPTIONS.map((status) => (
          <FilterChip
            key={status || 'all-status'}
            label={STATUS_LABELS[status]}
            selected={filters.status === status}
            onPress={() => onFiltersChange({ status: filters.status === status ? '' : status })}
          />
        ))}
      </ScrollView>

      {(tab === 'all' || tab === 'deposit' || tab === 'withdraw') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {METHOD_OPTIONS.map((method) => (
            <FilterChip
              key={method}
              label={METHOD_LABELS[method]}
              selected={filters.method === method}
              onPress={() => onFiltersChange({ method })}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.dateRow}>
        <FilterChip
          label={filters.startDate ? `From ${filters.startDate}` : 'This month start'}
          selected={!!filters.startDate}
          onPress={() => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            onFiltersChange({ startDate: filters.startDate ? '' : first });
          }}
        />
        <FilterChip
          label={filters.endDate ? `To ${filters.endDate}` : 'This month end'}
          selected={!!filters.endDate}
          onPress={() => {
            const now = new Date();
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
            onFiltersChange({ endDate: filters.endDate ? '' : last });
          }}
        />
        <FilterChip label="Reset filters" selected={false} onPress={onReset} />
      </View>

      {(tab === 'deposit' || tab === 'all') && (
        <View style={[styles.liveBanner, { backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.08)` }]}>
          <Text style={{ color: `hsl(${theme.colors.tradeBuy})`, fontSize: 11, fontWeight: '600' }}>Live deposit updates</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  chips: { gap: 8, paddingVertical: 4 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  liveBanner: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 },
});
