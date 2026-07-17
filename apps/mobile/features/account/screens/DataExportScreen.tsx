import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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
  ExchangeCard,
  StatusChip,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
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

function exportStatusTone(status: ExportLog['status']): StatusChipTone {
  return status === 'completed' ? 'live' : 'off';
}

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
  const warning = semanticStatusPalette(theme.colors, 'warning');

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
        contentContainerStyle={{ padding: theme.spacing[4], paddingBottom: theme.spacing[8] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[1] }]}>
          Data Export
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[4] },
          ]}
        >
          Download account activity exports. Account statements are temporarily disabled until backend job pipeline is enabled.
        </Text>

        <ExchangeCard style={{ marginBottom: theme.spacing[3], padding: theme.spacing[2] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing[1.5],
                      borderRadius: theme.radius.md + 2,
                      paddingHorizontal: theme.spacing[3],
                      paddingVertical: theme.spacing[2],
                    },
                    active && { backgroundColor: `hsl(${theme.colors.brandPrimary})` },
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={theme.sizes.iconXs}
                    color={active ? `hsl(${theme.colors.brandPrimaryForeground})` : `hsl(${theme.colors.foregroundSecondary})`}
                  />
                  <Text
                    style={[
                      theme.typography.labelMd,
                      {
                        color: active ? `hsl(${theme.colors.brandPrimaryForeground})` : `hsl(${theme.colors.foregroundSecondary})`,
                        fontFamily: theme.fonts.sansSemiBold,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ExchangeCard>

        {activeTab === 'account' ? (
          <ExchangeCard
            style={{
              marginBottom: theme.spacing[3],
              borderColor: warning.border,
              backgroundColor: warning.bg,
            }}
          >
            <View style={{ flexDirection: 'row', gap: theme.spacing[2.5] }}>
              <Ionicons name="warning-outline" size={theme.sizes.iconXs + 2} color={warning.fg} />
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.bodyMd, { color: warning.fg, fontFamily: theme.fonts.sansBold }]}>
                  Account statement export is not live yet.
                </Text>
                <Text style={[theme.typography.bodySm, { color: warning.fg, marginTop: theme.spacing[1], opacity: theme.opacity.pressed }]}>
                  Use trade and wallet exports for now. This prevents showing a fake export flow.
                </Text>
              </View>
            </View>
          </ExchangeCard>
        ) : (
          <ExchangeCard style={{ marginBottom: theme.spacing[3] }}>
            <Text
              style={[
                theme.typography.labelMd,
                { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, marginBottom: theme.spacing[2] },
              ]}
            >
              Type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
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

            <Text
              style={[
                theme.typography.labelMd,
                {
                  color: `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: theme.fonts.sansSemiBold,
                  marginTop: theme.spacing[3],
                  marginBottom: theme.spacing[2],
                },
              ]}
            >
              Time Range
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
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
              <View style={{ gap: theme.spacing[2.5], marginTop: theme.spacing[3] }}>
                <TextField label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
                <TextField label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2026-12-31" />
              </View>
            ) : null}

            {error ? (
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.tradeSell})`, marginTop: theme.spacing[3] }]}>
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[3], alignItems: 'flex-start' }}>
              <PrimaryButton
                title={running ? 'Preparing export...' : 'Export CSV'}
                onPress={() => void handleExport()}
                disabled={!canRun || running}
                loading={running}
              />
              <Pressable onPress={openWalletHistory}>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                  ]}
                >
                  Open full wallet history
                </Text>
              </Pressable>
            </View>
          </ExchangeCard>
        )}

        <ExchangeCard>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                marginBottom: theme.spacing[3],
                paddingBottom: theme.spacing[2],
                borderBottomWidth: 1,
                borderBottomColor: `hsl(${theme.colors.borderDefault})`,
              },
            ]}
          >
            Export Activity
          </Text>
          {logs.length === 0 ? (
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              No export jobs in this session.
            </Text>
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing[2.5],
                  borderWidth: 1,
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  borderRadius: theme.radius.md + 2,
                  padding: theme.spacing[2.5],
                  marginBottom: theme.spacing[2],
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <Text
                      style={[
                        theme.typography.bodyMd,
                        { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                      ]}
                    >
                      {log.kind} export
                    </Text>
                    <StatusChip label={log.status} tone={exportStatusTone(log.status)} />
                  </View>
                  <Text
                    style={[
                      theme.typography.labelSm,
                      { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
                    ]}
                  >
                    {new Date(log.requestedAt).toLocaleString()} · rows: {log.rows}
                  </Text>
                </View>
                <Text
                  style={[
                    theme.typography.bodySm,
                    {
                      color: log.status === 'completed' ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.tradeSell})`,
                      maxWidth: theme.spacing[12] * 2 + theme.spacing[6],
                    },
                  ]}
                  numberOfLines={2}
                >
                  {log.fileName ?? log.reason ?? 'Failed'}
                </Text>
              </View>
            ))
          )}
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
