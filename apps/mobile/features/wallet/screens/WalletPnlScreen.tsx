import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SegmentControl,
  SkeletonList,
  ErrorBanner,
  ErrorState,
  EmptyState,
  Avatar,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import {
  PNL_PERIODS,
  extractSymbolOptions,
  filterSymbolsBySearch,
  getBestPerformer,
  getWorstPerformer,
  hasNoPnlData,
  maxAbsPnl,
  pnlSign,
  sortPnlAssets,
  type PnlPeriod,
  type PnlSortDir,
  type PnlSortKey,
} from '@core/domain/wallet/pnl';
import { usePnl } from '../hooks/useWallet';
import { PnlEquityChart } from '../components/PnlEquityChart';
import { PnlSummaryCards } from '../components/PnlSummaryCards';
import { PnlAssetListHeader, PnlAssetRow } from '../components/PnlAssetRow';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WalletPnl'>;

export function WalletPnlScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const showBalances = useWalletPrefsStore((s) => s.showBalances);

  const [period, setPeriod] = useState<PnlPeriod>('7d');
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolModal, setShowSymbolModal] = useState(false);
  const [sortKey, setSortKey] = useState<PnlSortKey>('pnl');
  const [sortDir, setSortDir] = useState<PnlSortDir>('desc');
  const [refreshing, setRefreshing] = useState(false);

  const pnlQ = usePnl({ period, type: 'all', symbol: selectedSymbol });

  useEffect(() => {
    analytics.screen('S-553');
  }, []);

  const pnlData = pnlQ.data;
  const assets = useMemo(() => pnlData?.assets ?? [], [pnlData]);
  const totalPnl = pnlData?.totalPnl ?? 0;
  const totalPnlPercent = pnlData?.totalPnlPercent ?? 0;
  const loading = pnlQ.isLoading;
  const noData = hasNoPnlData(loading, assets, totalPnl);

  const sortedAssets = useMemo(
    () => sortPnlAssets(assets, sortKey, sortDir),
    [assets, sortKey, sortDir],
  );
  const bestPerformer = useMemo(() => getBestPerformer(assets), [assets]);
  const worstPerformer = useMemo(() => getWorstPerformer(assets), [assets]);
  const absMax = useMemo(() => maxAbsPnl(assets), [assets]);

  const symbolOptions = useMemo(() => extractSymbolOptions(assets), [assets]);
  const filteredSymbols = useMemo(
    () => filterSymbolsBySearch(symbolOptions, symbolSearch),
    [symbolOptions, symbolSearch],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pnlQ.refetch();
    setRefreshing(false);
  }, [pnlQ]);

  const handleSort = useCallback(
    (key: PnlSortKey) => {
      void hapticLight();
      if (sortKey === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const handleSymbolSelect = useCallback((sym: string) => {
    setSelectedSymbol(sym);
    setShowSymbolModal(false);
    setSymbolSearch('');
  }, []);

  const pnlColor =
    totalPnl > 0
      ? `hsl(${theme.colors.tradeBuy})`
      : totalPnl < 0
        ? `hsl(${theme.colors.tradeSell})`
        : `hsl(${theme.colors.foregroundSecondary})`;

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            P&L Analysis
          </Text>
          <View style={[styles.badge, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}>
            <Ionicons name="bar-chart-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 12 }}>
              Performance
            </Text>
          </View>
        </View>
        <Pressable onPress={() => void onRefresh()} hitSlop={10} accessibilityLabel="Refresh P&L">
          <Ionicons
            name="refresh"
            size={22}
            color={`hsl(${theme.colors.foregroundSecondary})`}
            style={loading ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached P&L where available" onRetry={() => void onRefresh()} />
      ) : null}

      {pnlQ.isError && !pnlData ? (
        <ErrorState title="Could not load P&L" onRetry={() => void pnlQ.refetch()} />
      ) : null}

      <View style={[styles.filterCard, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <SegmentControl
          tabs={PNL_PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          active={period}
          onChange={(id) => setPeriod(id as PnlPeriod)}
        />
        <Pressable
          onPress={() => setShowSymbolModal(true)}
          style={[styles.symbolBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}
        >
          <Ionicons name="filter-outline" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={{ flex: 1, color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 14 }}>
            {selectedSymbol === 'all' ? 'All Symbols' : selectedSymbol}
          </Text>
          <Ionicons name="chevron-down" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
        </Pressable>
      </View>

      {loading && !pnlData ? <SkeletonList rows={8} /> : null}

      {noData && !loading ? (
        <EmptyState
          title="No P&L data available"
          message="Start trading to see your profit & loss analysis. Your performance summary and per-asset breakdown will appear here."
          icon="bar-chart-outline"
          actionLabel="Go to Spot Trading"
          onAction={() =>
            navigation.getParent()?.navigate('Trade', { screen: 'SpotTrading' })
          }
        />
      ) : null}

      {!noData && pnlData ? (
        <>
          <View style={[styles.chartCard, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
            <View style={[styles.chartHeader, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                Cumulative P&L
              </Text>
              <Text style={{ fontWeight: '700', color: pnlColor }}>
                {maskBalance(`${pnlSign(totalPnl)}$${formatUsd(Math.abs(totalPnl))}`, showBalances)}
              </Text>
            </View>
            <View style={styles.chartBody}>
              {loading ? (
                <View style={styles.chartLoading}>
                  <Ionicons name="refresh" size={24} color={`hsl(${theme.colors.brandPrimary})`} />
                </View>
              ) : (
                <PnlEquityChart assets={sortedAssets} totalPnl={totalPnl} />
              )}
            </View>
          </View>

          <PnlSummaryCards
            totalPnl={totalPnl}
            totalPnlPercent={totalPnlPercent}
            bestPerformer={bestPerformer}
            worstPerformer={worstPerformer}
            showBalances={showBalances}
          />

          <View style={[styles.tableCard, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
            <View style={[styles.chartHeader, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                P&L by Asset
              </Text>
              <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>
                {assets.length} asset{assets.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <PnlAssetListHeader
              activeSort={sortKey}
              sortDir={sortDir}
              onSortPnl={() => handleSort('pnl')}
              onSortPercent={() => handleSort('pnlPercent')}
              onSortQuantity={() => handleSort('quantity')}
            />
          </View>
        </>
      ) : null}

      {pnlQ.isError && pnlData ? (
        <ErrorBanner message="P&L refresh failed — showing cached data" onRetry={() => void pnlQ.refetch()} />
      ) : null}
    </View>
  );

  return (
    <ScreenLayout testID="S-553">
      <FlatList
        data={noData || loading ? [] : sortedAssets}
        keyExtractor={(item) => item.symbol}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <PnlAssetRow asset={item} showBalances={showBalances} maxPnl={absMax} />
        )}
        ListEmptyComponent={
          !noData && !loading && sortedAssets.length === 0 ? (
            <View style={styles.filteredEmpty}>
              <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>
                No assets found for this filter
              </Text>
              {selectedSymbol !== 'all' ? (
                <Pressable onPress={() => handleSymbolSelect('all')}>
                  <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', marginTop: 8 }}>
                    Show all symbols
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={showSymbolModal} animationType="slide" transparent onRequestClose={() => setShowSymbolModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSymbolModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              Filter by symbol
            </Text>
            <SearchBar value={symbolSearch} onChangeText={setSymbolSearch} placeholder="Search symbol…" />
            <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
              <Pressable
                onPress={() => handleSymbolSelect('all')}
                style={[styles.symbolOption, selectedSymbol === 'all' && { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}
              >
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
                  All Symbols
                </Text>
              </Pressable>
              {filteredSymbols.map((sym) => (
                <Pressable
                  key={sym}
                  onPress={() => handleSymbolSelect(sym)}
                  style={[styles.symbolOption, sym === selectedSymbol && { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}
                >
                  <Avatar name={sym} size="sm" />
                  <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{sym}</Text>
                </Pressable>
              ))}
              {filteredSymbols.length === 0 ? (
                <Text style={{ textAlign: 'center', color: `hsl(${theme.colors.foregroundSecondary})`, padding: 16 }}>
                  No matches
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 32 },
  headerBlock: { gap: 12, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  filterCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 12 },
  symbolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chartCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chartBody: { paddingHorizontal: 8, paddingVertical: 8 },
  chartLoading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  tableCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  filteredEmpty: { alignItems: 'center', paddingVertical: 32 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  symbolOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
});
