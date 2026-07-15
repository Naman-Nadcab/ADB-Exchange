import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel, TerminalTabs, PrimaryButton, SecondaryButton, EmptyState, SkeletonList, StatusChip } from '@shared/ui';
import { GuestAuthPrompt } from '@features/auth';
import { useTradingBalances } from '@features/wallet';
import { useOpenOrders, useCancelAllOrders } from '../hooks/useTrade';
import { useSpotOrderHistory, useSpotTradeHistory } from '../hooks/useSpotPanelQueries';
import { SpotOpenOrderRow } from './SpotOpenOrderRow';
import { formatPrice } from '@core/domain/markets/formatPrice';

type BottomTab = 'open' | 'orders' | 'trades' | 'assets' | 'positions';

type Props = {
  symbol: string;
  isAuth: boolean;
  markets?: { symbol: string; price_precision?: number; qty_precision?: number }[];
};

function HistoryOrderRow({
  side,
  market,
  type,
  quantity,
  price,
  status,
  time,
}: {
  side: string;
  market: string;
  type: string;
  quantity: string;
  price: string;
  status: string;
  time: string;
}) {
  const { theme } = useTheme();
  const sideColor = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
  return (
    <TerminalPanel subtle style={styles.historyRow}>
      <View style={styles.historyTop}>
        <Text style={{ color: `hsl(${sideColor})`, fontWeight: '600', textTransform: 'capitalize' }}>
          {side} · {type.replace(/_/g, ' ')}
        </Text>
        <StatusChip label={status} tone="neutral" />
      </View>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono, marginTop: 4 }}>
        {quantity} @ {price}
      </Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 2 }}>{market} · {time}</Text>
    </TerminalPanel>
  );
}

export function SpotBottomPanel({ symbol, isAuth }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<BottomTab>('open');
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [cancelAllArmed, setCancelAllArmed] = useState(false);
  const cancelArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openQ = useOpenOrders(isAuth);
  const orderHistQ = useSpotOrderHistory(showAllMarkets ? undefined : symbol, isAuth);
  const tradeHistQ = useSpotTradeHistory(showAllMarkets ? undefined : symbol, isAuth);
  const balancesQ = useTradingBalances(isAuth);
  const cancelAll = useCancelAllOrders();

  const openOrders = useMemo(() => {
    const all = openQ.data ?? [];
    return showAllMarkets ? all : all.filter((o) => o.market === symbol);
  }, [openQ.data, showAllMarkets, symbol]);

  const orderItems = useMemo(
    () => orderHistQ.data?.pages.flatMap((p) => p) ?? [],
    [orderHistQ.data],
  );
  const tradeItems = useMemo(
    () => tradeHistQ.data?.pages.flatMap((p) => p) ?? [],
    [tradeHistQ.data],
  );

  const assets = useMemo(() => {
    const rows = balancesQ.data?.balances.filter((b) => parseFloat(b.equity) > 0) ?? [];
    const filtered = hideSmallBalances ? rows.filter((b) => parseFloat(b.equity) >= 0.0001) : rows;
    return filtered.slice(0, 24);
  }, [balancesQ.data, hideSmallBalances]);

  useEffect(
    () => () => {
      if (cancelArmTimer.current) clearTimeout(cancelArmTimer.current);
    },
    [],
  );

  const handleCancelAll = useCallback(() => {
    if (!cancelAllArmed) {
      setCancelAllArmed(true);
      if (cancelArmTimer.current) clearTimeout(cancelArmTimer.current);
      cancelArmTimer.current = setTimeout(() => setCancelAllArmed(false), 6000);
      return;
    }
    setCancelAllArmed(false);
    cancelAll.mutate(symbol);
  }, [cancelAllArmed, cancelAll, symbol]);

  if (!isAuth) {
    return (
      <TerminalPanel style={{ marginTop: 12 }}>
        <GuestAuthPrompt
          title="Sign in to view orders & assets"
          message="Open orders, history, fills, and trading balances appear here after login."
        />
      </TerminalPanel>
    );
  }

  const filterToggle = (
    <View style={styles.filterRow}>
      <Pressable onPress={() => setShowAllMarkets((v) => !v)} style={styles.filterBtn}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, fontWeight: '600' }}>
          {showAllMarkets ? 'All markets' : 'This pair'}
        </Text>
      </Pressable>
      {(tab === 'open' && openOrders.length > 0) ? (
        <SecondaryButton
          title={cancelAllArmed ? 'Confirm cancel all' : 'Cancel all'}
          size="sm"
          onPress={handleCancelAll}
          loading={cancelAll.isPending}
        />
      ) : null}
      {tab === 'assets' ? (
        <View style={styles.switchRow}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>Hide small</Text>
          <Switch value={hideSmallBalances} onValueChange={setHideSmallBalances} />
        </View>
      ) : null}
    </View>
  );

  return (
    <TerminalPanel style={{ marginTop: 12 }}>
      <TerminalTabs
        tabs={[
          { id: 'open', label: 'Open' },
          { id: 'orders', label: 'History' },
          { id: 'trades', label: 'Fills' },
          { id: 'assets', label: 'Assets' },
          { id: 'positions', label: 'Positions' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as BottomTab)}
      />
      {filterToggle}

      {tab === 'open' && (
        openQ.isLoading && !openOrders.length ? (
          <SkeletonList rows={3} />
        ) : openOrders.length === 0 ? (
          <EmptyState title="No open orders" message={showAllMarkets ? 'No working orders across markets' : `No open orders for ${symbol.replace('_', '/')}`} />
        ) : (
          <FlatList
            data={openOrders}
            scrollEnabled={false}
            keyExtractor={(o) => o.id}
            renderItem={({ item }) => <SpotOpenOrderRow order={item} />}
          />
        )
      )}

      {tab === 'orders' && (
        orderHistQ.isLoading && !orderItems.length ? (
          <SkeletonList rows={3} />
        ) : orderItems.length === 0 ? (
          <EmptyState title="No order history" message="Completed and cancelled orders appear here" />
        ) : (
          <>
            {orderItems.map((o) => (
              <HistoryOrderRow
                key={o.id}
                side={o.side}
                market={o.market}
                type={o.type ?? 'limit'}
                quantity={o.quantity}
                price={o.price ?? '—'}
                status={o.status}
                time={o.created_at}
              />
            ))}
            {orderHistQ.hasNextPage ? (
              <PrimaryButton title="Load more" size="sm" onPress={() => void orderHistQ.fetchNextPage()} loading={orderHistQ.isFetchingNextPage} />
            ) : null}
          </>
        )
      )}

      {tab === 'trades' && (
        tradeHistQ.isLoading && !tradeItems.length ? (
          <SkeletonList rows={3} />
        ) : tradeItems.length === 0 ? (
          <EmptyState title="No fills yet" message="Your executed trades will appear here" />
        ) : (
          <>
            {tradeItems.map((t) => (
              <HistoryOrderRow
                key={t.id}
                side={t.side}
                market={t.market}
                type="fill"
                quantity={t.quantity}
                price={t.price}
                status="filled"
                time={t.time ?? t.created_at ?? '—'}
              />
            ))}
            {tradeHistQ.hasNextPage ? (
              <PrimaryButton title="Load more" size="sm" onPress={() => void tradeHistQ.fetchNextPage()} loading={tradeHistQ.isFetchingNextPage} />
            ) : null}
          </>
        )
      )}

      {tab === 'assets' && (
        balancesQ.isLoading && !assets.length ? (
          <SkeletonList rows={3} />
        ) : assets.length === 0 ? (
          <EmptyState title="No trading balances" message="Deposit funds to your trading account" />
        ) : (
          assets.map((a) => (
            <View key={a.symbol} style={[styles.assetRow, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{a.symbol}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono }}>
                {formatPrice(parseFloat(a.equity), a.symbol)}
              </Text>
            </View>
          ))
        )
      )}

      {tab === 'positions' && (
        balancesQ.isLoading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} />
        ) : assets.length === 0 ? (
          <EmptyState title="No positions" message="Assets with trading balance appear as positions" />
        ) : (
          assets.map((a) => {
            const eq = parseFloat(a.equity);
            const active = eq >= 0.0001;
            return (
              <View key={`pos-${a.symbol}`} style={[styles.assetRow, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{a.symbol}</Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono }}>
                  {formatPrice(eq, a.symbol)}
                </Text>
                <StatusChip label={active ? 'Active' : 'Idle'} tone={active ? 'live' : 'neutral'} />
              </View>
            );
          })
        )
      )}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8, gap: 8 },
  filterBtn: { paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyRow: { marginBottom: 8 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
});
