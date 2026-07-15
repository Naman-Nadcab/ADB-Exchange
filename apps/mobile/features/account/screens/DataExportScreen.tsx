import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  PrimaryButton,
  TextField,
  FilterChip,
  ErrorBanner,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ordersToCsv, walletTransactionsToCsv } from '@core/domain/export/csv';
import {
  createExportLog,
  fetchAllHistoryOrdersForExport,
  fetchAllWalletTransactionsForExport,
  filterOrdersForExport,
  filterWalletTransactions,
  toDateBounds,
  type DataExportTab,
  type ExportLog,
  type OrderExportType,
  type TimeRangeType,
  type TransactionExportType,
} from '@core/domain/export/dataExport';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'DataExport'>;

const TABS: { id: DataExportTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'transaction', label: 'Transaction Log', icon: 'document-text-outline' },
  { id: 'order', label: 'Order History', icon: 'time-outline' },
  { id: 'account', label: 'Account Statement', icon: 'grid-outline' },
];

const TIME_RANGES: { id: TimeRangeType; label: string }[] = [
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: '90days', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
];

export function DataExportScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [activeTab, setActiveTab] = useState<DataExportTab>('transaction');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txExportType, setTxExportType] = useState<TransactionExportType>('all');
  const [orderExportType, setOrderExportType] = useState<OrderExportType>('all');
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExportLog[]>([]);

  useEffect(() => {
    analytics.screen('S-753');
  }, []);

  const canRun = useMemo(() => {
    if (activeTab === 'account') return false;
    if (timeRange !== 'custom') return true;
    return Boolean(startDate.trim() && endDate.trim());
  }, [activeTab, timeRange, startDate, endDate]);

  const appendLog = useCallback((entry: Omit<ExportLog, 'id' | 'requestedAt'>) => {
    setLogs((prev) => [createExportLog(entry), ...prev.slice(0, 24)]);
  }, []);

  const openWalletHistory = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: { screen: 'Wallet', params: { screen: 'WalletHistory' } },
      }),
    );
  }, [navigation]);

  const handleExport = useCallback(async () => {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    try {
      const { start, end } = toDateBounds(timeRange, startDate, endDate);
      const stamp = new Date().toISOString().slice(0, 10);

      if (activeTab === 'order') {
        const orders = await fetchAllHistoryOrdersForExport();
        const filtered = filterOrdersForExport(orders, start, end, orderExportType);
        const csv = ordersToCsv(filtered);
        const fileName = `spot-orders-${stamp}.csv`;
        await Share.share({ message: csv, title: fileName });
        appendLog({ kind: 'order', status: 'completed', rows: filtered.length, fileName });
        return;
      }

      const transactions = await fetchAllWalletTransactionsForExport();
      const filtered = filterWalletTransactions(transactions, start, end, txExportType);
      const csv = walletTransactionsToCsv(filtered);
      const fileName = `wallet-transactions-${stamp}.csv`;
      await Share.share({ message: csv, title: fileName });
      appendLog({ kind: 'transaction', status: 'completed', rows: filtered.length, fileName });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      appendLog({ kind: activeTab, status: 'failed', rows: 0, reason: message });
    } finally {
      setRunning(false);
    }
  }, [
    activeTab,
    appendLog,
    canRun,
    endDate,
    orderExportType,
    running,
    startDate,
    timeRange,
    txExportType,
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRefreshing(false);
  }, []);

  return (
    <ScreenLayout testID="S-753">
      {!isOnline ? (
        <ErrorBanner message="Offline — connect to export data" onRetry={() => setError(null)} />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Data Export</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginBottom: 16 }}>
          Download account activity exports. Account statements are temporarily disabled until backend job pipeline is enabled.
        </Text>

        <View style={[styles.tabRow, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabBtn,
                  active && { backgroundColor: `hsl(${theme.colors.brandPrimary})` },
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={active ? `hsl(${theme.colors.brandPrimaryForeground})` : `hsl(${theme.colors.foregroundSecondary})`}
                />
                <Text
                  style={{
                    color: active ? `hsl(${theme.colors.brandPrimaryForeground})` : `hsl(${theme.colors.foregroundSecondary})`,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'account' ? (
          <View style={[styles.warningBox, { borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.12)' }]}>
            <Ionicons name="warning-outline" size={18} color="#fbbf24" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fde68a', fontWeight: '700' }}>Account statement export is not live yet.</Text>
              <Text style={{ color: 'rgba(253,230,138,0.85)', marginTop: 4, fontSize: 13 }}>
                Use trade and wallet exports for now. This prevents showing a fake export flow.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
            <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Type</Text>
            <View style={styles.chips}>
              {activeTab === 'order' ? (
                <>
                  <FilterChip label="All orders" selected={orderExportType === 'all'} onPress={() => setOrderExportType('all')} />
                  <FilterChip label="Trade orders" selected={orderExportType === 'trade'} onPress={() => setOrderExportType('trade')} />
                </>
              ) : (
                <>
                  <FilterChip label="All transactions" selected={txExportType === 'all'} onPress={() => setTxExportType('all')} />
                  <FilterChip label="Deposits" selected={txExportType === 'deposit'} onPress={() => setTxExportType('deposit')} />
                  <FilterChip label="Withdrawals" selected={txExportType === 'withdrawal'} onPress={() => setTxExportType('withdrawal')} />
                  <FilterChip label="Transfers" selected={txExportType === 'transfer'} onPress={() => setTxExportType('transfer')} />
                </>
              )}
            </View>

            <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 12 }]}>Time Range</Text>
            <View style={styles.chips}>
              {TIME_RANGES.map((range) => (
                <FilterChip
                  key={range.id}
                  label={range.label}
                  selected={timeRange === range.id}
                  onPress={() => setTimeRange(range.id)}
                />
              ))}
            </View>

            {timeRange === 'custom' ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                <TextField label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
                <TextField label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2026-12-31" />
              </View>
            ) : null}

            {error ? (
              <Text style={{ color: `hsl(${theme.colors.tradeSell})`, marginTop: 12, fontSize: 13 }}>{error}</Text>
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                title={running ? 'Preparing export...' : 'Export CSV'}
                onPress={() => void handleExport()}
                disabled={!canRun || running}
                loading={running}
              />
              <Pressable onPress={openWalletHistory}>
                <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 14 }}>
                  Open full wallet history
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
          <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})`, borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            Export Activity
          </Text>
          {logs.length === 0 ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
              No export jobs in this session.
            </Text>
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                style={[styles.logRow, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                    {log.kind} export - {log.status}
                  </Text>
                  <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
                    {new Date(log.requestedAt).toLocaleString()} · rows: {log.rows}
                  </Text>
                </View>
                <Text
                  style={{
                    color: log.status === 'completed' ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.tradeSell})`,
                    fontSize: 12,
                    maxWidth: 120,
                  }}
                  numberOfLines={2}
                >
                  {log.fileName ?? log.reason ?? 'Failed'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  warningBox: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { marginTop: 16, gap: 12, alignItems: 'flex-start' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
});
