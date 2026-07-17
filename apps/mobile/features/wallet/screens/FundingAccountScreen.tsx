import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SegmentControl,
  SkeletonList,
  ErrorBanner,
  EmptyState,
  ErrorState,
  PrimaryButton,
} from '@shared/ui';
import { useGuestAccess } from '@features/auth';
import { useTheme, hapticLight, hsl } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import {
  filterFundingBalances,
  sortFundingBalances,
  paginateItems,
  FUNDING_PAGE_SIZE,
  type FundingSortKey,
  type SortDirection,
} from '@core/domain/wallet/portfolio';
import { useFundingBalances } from '../hooks/useWallet';
import { FundingEquitySummary } from '../components/FundingEquitySummary';
import { FundingBalanceRow } from '../components/FundingBalanceRow';
import type { WalletStackParamList } from '../navigation/types';
import type { AssetBalance } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<WalletStackParamList, 'FundingAccount'>;

type AssetTab = 'crypto' | 'fiat';

const SORT_TABS: { id: FundingSortKey; label: string }[] = [
  { id: 'symbol', label: 'Symbol' },
  { id: 'balance', label: 'Balance' },
  { id: 'value', label: 'Value' },
];

export function FundingAccountScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { requireAuth } = useGuestAccess();
  const isOnline = useAppStore((s) => s.isOnline);
  const fundingQ = useFundingBalances();

  const hideSmall = useWalletPrefsStore((s) => s.hideSmall);
  const showBalances = useWalletPrefsStore((s) => s.showBalances);
  const hydrate = useWalletPrefsStore((s) => s.hydrate);
  const setHideSmall = useWalletPrefsStore((s) => s.setHideSmall);
  const toggleShowBalances = useWalletPrefsStore((s) => s.toggleShowBalances);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<FundingSortKey>('value');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<AssetTab>('crypto');

  useEffect(() => {
    hydrate();
    analytics.screen('S-502');
  }, [hydrate]);

  useEffect(() => {
    setPage(1);
  }, [search, hideSmall, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const rows = filterFundingBalances(fundingQ.data?.balances ?? [], { search, hideSmall });
    return sortFundingBalances(rows, sortKey, sortDir);
  }, [fundingQ.data?.balances, search, hideSmall, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / FUNDING_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginated = useMemo(
    () => paginateItems(filtered, safePage, FUNDING_PAGE_SIZE),
    [filtered, safePage],
  );

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * FUNDING_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * FUNDING_PAGE_SIZE, filtered.length);

  const onRefresh = useCallback(() => {
    void fundingQ.refetch();
  }, [fundingQ]);

  const onSortChange = (key: FundingSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const onDeposit = (symbol: string, name: string) => {
    if (!requireAuth()) return;
    navigation.navigate('DepositNetwork', { symbol, name });
  };

  const onWithdraw = (symbol: string, name: string) => {
    if (!requireAuth()) return;
    navigation.navigate('WithdrawNetwork', { symbol, name });
  };

  const onTransfer = () => {
    if (!requireAuth()) return;
    navigation.navigate('Transfer', { from: 'funding' });
  };

  const isLoading = fundingQ.isLoading && !fundingQ.data;
  const emptyMessage =
    search.trim().length > 0
      ? 'Try a different search term or clear filters.'
      : hideSmall && (fundingQ.data?.balances.length ?? 0) > 0
        ? 'All rows are hidden while hide small balances is on. Turn it off to see every asset.'
        : 'Deposit crypto to see balances here.';

  const renderRow = ({ item }: { item: AssetBalance }) => (
    <FundingBalanceRow
      balance={item}
      showBalances={showBalances}
      onDeposit={() => onDeposit(item.symbol, item.name)}
      onWithdraw={() => onWithdraw(item.symbol, item.name)}
      onTransfer={onTransfer}
    />
  );

  const listHeader = (
    <View>
      <View style={[styles.heroRow, { gap: theme.spacing[2.5], marginBottom: theme.spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.displayMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            Funding Account
          </Text>
          <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Wallet balances for deposits & withdrawals
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void hapticLight();
            toggleShowBalances();
          }}
          hitSlop={10}
          accessibilityLabel="Toggle balance visibility"
        >
          <Ionicons
            name={showBalances ? 'eye-outline' : 'eye-off-outline'}
            size={theme.sizes.iconSm}
            color={hsl(theme.colors.foregroundSecondary)}
          />
        </Pressable>
        <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh balances">
          <Ionicons name="refresh" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundSecondary)} />
        </Pressable>
      </View>

      <View style={[styles.headerActions, { gap: theme.spacing[2], marginBottom: theme.spacing[3.5] }]}>
        <PrimaryButton title="Deposit" onPress={() => navigation.navigate('DepositHome')} style={styles.headerBtn} />
        <Pressable
          onPress={() => navigation.navigate('WithdrawHome')}
          style={[
            styles.secondaryBtn,
            {
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
              borderRadius: theme.radius.md + 2,
              paddingHorizontal: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Withdraw
          </Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Transfer')}
          style={[
            styles.secondaryBtn,
            {
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
              borderRadius: theme.radius.md + 2,
              paddingHorizontal: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Transfer
          </Text>
        </Pressable>
      </View>

      {!isOnline ? (
        <ErrorBanner message="Offline — showing cached balances where available" onRetry={onRefresh} />
      ) : null}

      {fundingQ.isError ? (
        <ErrorBanner message="Balances could not be loaded." onRetry={onRefresh} />
      ) : null}

      {isLoading ? (
        <SkeletonList rows={6} />
      ) : fundingQ.isError && !fundingQ.data ? (
        <ErrorState title="Could not load funding account" onRetry={onRefresh} />
      ) : (
        <>
          <FundingEquitySummary
            totalEquity={fundingQ.data?.totalEquity ?? { usd: '0' }}
            availableBalance={fundingQ.data?.availableBalance ?? { usd: '0' }}
            inUse={fundingQ.data?.inUse ?? { usd: '0' }}
            showBalances={showBalances}
          />

          <SegmentControl
            tabs={[
              { id: 'crypto', label: 'Crypto' },
              { id: 'fiat', label: 'Fiat' },
            ]}
            active={activeTab}
            onChange={(id) => setActiveTab(id as AssetTab)}
          />

          {activeTab === 'fiat' ? (
            <View
              style={[
                styles.fiatPanel,
                {
                  borderColor: hsl(theme.colors.borderDefault),
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing[6],
                  gap: theme.spacing[2],
                  marginTop: theme.spacing[3],
                },
              ]}
            >
              <Ionicons name="cash-outline" size={theme.sizes.iconLg} color={hsl(theme.colors.foregroundSecondary)} />
              <Text
                style={[
                  theme.typography.headingMd,
                  { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
                ]}
              >
                Buy & sell with fiat
              </Text>
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: hsl(theme.colors.foregroundSecondary), textAlign: 'center' },
                ]}
              >
                Buy and sell crypto with INR through P2P trading — no self-serve bank deposit page yet. Withdraw INR
                from your fiat balance after P2P sells or team credit.
              </Text>
              <PrimaryButton
                title="Go to P2P trading"
                onPress={() => navigation.getParent()?.navigate('P2P', { screen: 'Marketplace' })}
                style={{ marginTop: theme.spacing[3.5] }}
              />
            </View>
          ) : (
            <>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin…" />
              <View style={[styles.toggleRow, { marginVertical: theme.spacing[2] }]}>
                <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
                  Hide small balances
                </Text>
                <Switch value={hideSmall} onValueChange={setHideSmall} />
              </View>
              {filtered.length > 0 ? (
                <Text
                  style={[
                    theme.typography.bodySm,
                    { color: hsl(theme.colors.foregroundSecondary), marginBottom: theme.spacing[2] },
                  ]}
                >
                  {filtered.length} asset{filtered.length === 1 ? '' : 's'}
                </Text>
              ) : null}
              <View style={[styles.sortRow, { gap: theme.spacing[2], marginBottom: theme.spacing[2.5] }]}>
                {SORT_TABS.map((tab) => {
                  const active = sortKey === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => onSortChange(tab.id)}
                      style={[
                        styles.sortChip,
                        {
                          borderColor: hsl(theme.colors.borderDefault),
                          borderRadius: theme.radius.md,
                          paddingHorizontal: theme.spacing[2.5],
                          paddingVertical: theme.spacing[2],
                          backgroundColor: active
                            ? `hsl(${theme.colors.brandPrimary} / 0.12)`
                            : hsl(theme.colors.surfaceMuted),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          theme.typography.bodySm,
                          {
                            fontFamily: theme.fonts.sansSemiBold,
                            color: active
                              ? hsl(theme.colors.brandPrimary)
                              : hsl(theme.colors.foregroundSecondary),
                          },
                        ]}
                      >
                        {tab.label}
                        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );

  return (
    <ScreenLayout testID="S-502">
      {activeTab === 'crypto' && !isLoading && !(fundingQ.isError && !fundingQ.data) ? (
        <FlatList
          data={paginated}
          keyExtractor={(item) => item.token_id ?? item.symbol}
          renderItem={renderRow}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={fundingQ.isFetching} onRefresh={onRefresh} />}
          ListEmptyComponent={
            activeTab === 'crypto' ? (
              <EmptyState
                title="No assets found"
                message={emptyMessage}
                actionLabel={!search.trim() && !(hideSmall && (fundingQ.data?.balances.length ?? 0) > 0) ? 'Deposit' : undefined}
                onAction={
                  !search.trim() && !(hideSmall && (fundingQ.data?.balances.length ?? 0) > 0)
                    ? () => navigation.navigate('DepositHome')
                    : undefined
                }
              />
            ) : null
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <View style={[styles.pagination, { paddingVertical: theme.spacing[4], gap: theme.spacing[2.5] }]}>
                <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
                  Showing {rangeStart}–{rangeEnd} of {filtered.length}
                </Text>
                {pageCount > 1 ? (
                  <View style={styles.pageControls}>
                    <Pressable
                      disabled={safePage <= 1}
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                      style={[
                        styles.pageBtn,
                        { paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2.5] },
                        { opacity: safePage <= 1 ? theme.opacity.disabled : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          theme.typography.bodyMd,
                          { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
                        ]}
                      >
                        Previous
                      </Text>
                    </Pressable>
                    <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
                      Page {safePage} / {pageCount}
                    </Text>
                    <Pressable
                      disabled={safePage >= pageCount}
                      onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                      style={[
                        styles.pageBtn,
                        { paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2.5] },
                        { opacity: safePage >= pageCount ? theme.opacity.disabled : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          theme.typography.bodyMd,
                          { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
                        ]}
                      >
                        Next
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={fundingQ.isFetching} onRefresh={onRefresh} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap' },
  headerBtn: { flexGrow: 1, minWidth: 100 },
  secondaryBtn: {
    flexGrow: 1,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap' },
  sortChip: { borderWidth: StyleSheet.hairlineWidth },
  fiatPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  pagination: {},
  pageControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageBtn: {},
});
